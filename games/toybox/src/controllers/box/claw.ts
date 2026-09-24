import { inject, injectable } from 'inversify'
import type { DestroyOptions, Ticker } from 'pixi.js'

import {
  CLAW_PRIORITY,
  MIN_TRAVEL_MS,
  CART_SIZE,
  CLAW_DROP_MS,
  CLAW_GRAB_MS,
  CLAW_LIFT_MS,
  CLAW_MAX_SPEED,
  CLAW_RAMP_SHARE,
  CLAW_REST_HEIGHT,
  CLAW_TRAVEL_SPEED,
  CUBE_HEIGHT,
  FIELD_CENTER,
  SWAY_DAMPING,
  SWAY_DRAG,
  SWAY_MAX_OFFSET,
  SWAY_PERIOD_MS,
} from '#src/constants'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import type { ClawDrop, ClawMotion, ClawMotionOptions, GroundPoint, SpringState, WorldPoint } from '#src/types'
import { Cart } from '#src/ui/box/cart'
import { Claw } from '#src/ui/box/claw'
import { Rope } from '#src/ui/box/rope'
import { clampToField } from '#src/utils/machine-geometry'
import { lerp } from '#src/utils/math'
import { advanceSpring, advanceVelocity } from '#src/utils/motion'
import { isReducedMotion } from '@pixi-demos/core/accessibility'
import { easeTrapezoid, easeTrapezoidInverse } from '@pixi-demos/core/easing'
import { createAbortError } from '@pixi-demos/core/errors/utils'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/** Обновляет кинематику каретки и клешни перед шагом модели кучи на игровом тикере. */
@injectable()
export class ClawController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly toyboxStore: ToyboxStore
  private readonly cart = new Cart()
  private readonly rope = new Rope()
  private readonly claw = new Claw()
  private cartPosition: GroundPoint = FIELD_CENTER
  private clawHeight = CLAW_REST_HEIGHT
  private velocity: GroundPoint = { x: 0, y: 0 }
  /** Отклонение клешни от каретки по осям поля: маятник на тросе, по пружине на ось. */
  private swing: { x: SpringState; y: SpringState } = { x: { value: 0, velocity: 0 }, y: { value: 0, velocity: 0 } }
  /** Предыдущее положение каретки для расчёта скорости, вызывающей качание клешни. */
  private previous: GroundPoint = FIELD_CENTER
  private motion?: ClawMotion

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore
  ) {
    super()

    this.ticker = ticker
    this.toyboxStore = toyboxStore

    this.addChild(this.rope, this.cart, this.claw)
    this.render()

    this.ticker.add(this.step, undefined, CLAW_PRIORITY)
  }

  override destroy(options?: DestroyOptions): void {
    if (this.destroyed) return

    this.ticker.remove(this.step)
    this.motion?.cancel(createAbortError('Claw destroyed'))

    super.destroy(options)
  }

  /** Мировая точка каретки на потолке; качание клешни её не изменяет. */
  getCartPoint(): WorldPoint {
    return { ...this.cartPosition, z: CUBE_HEIGHT }
  }

  /** Актуальная мировая точка захвата, включая отклонение троса. */
  getGripPoint(): WorldPoint {
    return {
      x: this.cartPosition.x + this.swing.x.value,
      y: this.cartPosition.y + this.swing.y.value,
      z: this.clawHeight,
    }
  }

  /** Ведёт каретку к точке поля, сохраняя высоту клешни. */
  async moveTo(target: GroundPoint, signal?: AbortSignal): Promise<void> {
    await this.tween({ ...target, z: this.clawHeight }, this.getTravelMs(target), signal)
  }

  /** Доставляет каретку к цели и ждёт затухания клешни перед отпусканием игрушки. */
  async carryTo(target: GroundPoint, drop: ClawDrop | undefined, signal?: AbortSignal): Promise<void> {
    await this.tween({ ...target, z: this.clawHeight }, this.getTravelMs(target), signal, { drop, settleSwing: true })
  }

  /** Проигрывает захват на месте; сообщает прогресс 0–1 и точку захвата перед обновлением кучи. */
  async grab(onProgress: (progress: number, grip: WorldPoint) => void, signal: AbortSignal): Promise<void> {
    await this.tween({ ...this.cartPosition, z: this.clawHeight }, CLAW_GRAB_MS, signal, { onProgress })
  }

  /** Опускает клешню до высоты `toZ` */
  async descend(toZ: number, signal?: AbortSignal): Promise<void> {
    await this.tween({ ...this.cartPosition, z: toZ }, this.getLiftDuration(toZ, CLAW_DROP_MS), signal)
  }

  /** Поднимает клешню к каретке; заданное действие выполняется на доле пути `share`. */
  async ascend(drop?: ClawDrop, signal?: AbortSignal): Promise<void> {
    await this.tween(
      { ...this.cartPosition, z: CLAW_REST_HEIGHT },
      this.getLiftDuration(CLAW_REST_HEIGHT, CLAW_LIFT_MS),
      signal,
      { drop }
    )
  }

  /** Сколько клешне идти до точки поля. */
  private getTravelMs(target: GroundPoint): number {
    const distance = Math.hypot(target.x - this.cartPosition.x, target.y - this.cartPosition.y)

    return Math.max((distance / CLAW_TRAVEL_SPEED) * 1000, MIN_TRAVEL_MS)
  }

  /** Время хода по высоте: `fullMs` отмеряны на полную высоту куба. */
  private getLiftDuration(toZ: number, fullMs: number): number {
    return Math.max((fullMs * Math.abs(toZ - this.clawHeight)) / CUBE_HEIGHT, MIN_TRAVEL_MS)
  }

  /** Кадровый шаг: ход каретки по джойстику и качание клешни, которое идёт при любом её движении. */
  private step = (ticker: Ticker): void => {
    const previous = this.cartPosition
    const { clawHeight } = this
    const swingX = this.swing.x.value
    const swingY = this.swing.y.value

    if (this.motion) {
      this.advanceMotion(isReducedMotion() ? this.motion.durationMs : ticker.deltaMS)
    } else {
      this.drive(ticker.deltaMS)
      this.advanceSwing(ticker.deltaMS)
    }
    if (
      previous.x !== this.cartPosition.x ||
      previous.y !== this.cartPosition.y ||
      clawHeight !== this.clawHeight ||
      swingX !== this.swing.x.value ||
      swingY !== this.swing.y.value
    ) {
      this.render()
    }
  }

  /** Кадровый ход каретки по джойстику. Пока идёт движение фазы, ввод игрока не применяется. */
  private drive(deltaMs: number): void {
    const { direction } = this.toyboxStore
    const target = { x: direction.x * CLAW_MAX_SPEED, y: direction.y * CLAW_MAX_SPEED }

    this.velocity = advanceVelocity(this.velocity, target, deltaMs)

    if (this.velocity.x === 0 && this.velocity.y === 0) return

    const seconds = deltaMs / 1000
    const next = { x: this.cartPosition.x + this.velocity.x * seconds, y: this.cartPosition.y + this.velocity.y * seconds }
    const moved = clampToField(next, CART_SIZE / 2)

    // У стенки скорость гасится: иначе клешня копит её и отходит от стенки рывком
    if (moved.x !== next.x) this.velocity.x = 0
    if (moved.y !== next.y) this.velocity.y = 0

    this.cartPosition = moved
  }

  /**
   * Обновляет отклонение клешни по скорости каретки. Пружина меняет только точку захвата.
   */
  private advanceSwing(deltaMs: number): void {
    if (deltaMs <= 0) return

    const seconds = deltaMs / 1000
    const velocity = {
      x: (this.cartPosition.x - this.previous.x) / seconds,
      y: (this.cartPosition.y - this.previous.y) / seconds,
    }

    this.previous = { ...this.cartPosition }

    if (isReducedMotion()) {
      this.swing = { x: { value: 0, velocity: 0 }, y: { value: 0, velocity: 0 } }
      return
    }

    const x = this.advanceAxis(this.swing.x, velocity.x, deltaMs)
    const y = this.advanceAxis(this.swing.y, velocity.y, deltaMs)

    this.swing = { x, y }
  }

  /** Шаг одной оси маятника: цель тем дальше против хода, чем быстрее идёт каретка. */
  private advanceAxis(state: SpringState, velocity: number, deltaMs: number): SpringState {
    const drag = -velocity * SWAY_DRAG
    const target = Math.sign(drag) * Math.min(Math.abs(drag), SWAY_MAX_OFFSET)

    return advanceSpring(state, { target, periodMs: SWAY_PERIOD_MS, damping: SWAY_DAMPING }, deltaMs)
  }

  /**
   * Переносит положение на экран: каретка стоит над своей точкой верхней грани, клешня висит под ней
   * с отклонением маятника, трос их соединяет. Порядок наложения узла выставляет слой содержимого.
   */
  private render(): void {
    const visible = this.getGripPoint()
    const mount = this.getCartPoint()

    this.cart.setWorld(mount)
    this.rope.setSpan(mount, visible)
    this.claw.setWorld(visible)
  }

  /**
   * Ведёт каретку и высоту клешни к цели за `durationMs`; при `settleSwing` также ждёт затухания.
   * Отмена и замена движения отклоняют промис и снимают обработчик сигнала.
   */
  private tween(
    to: WorldPoint,
    durationMs: number,
    signal?: AbortSignal,
    options: ClawMotionOptions = {}
  ): Promise<void> {
    this.motion?.cancel(createAbortError('Claw motion replaced'))
    this.velocity = { x: 0, y: 0 }

    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason as Error)
        return
      }

      const abort = () => motion.cancel(signal?.reason)
      const cleanup = () => {
        signal?.removeEventListener('abort', abort)
        if (this.motion === motion) this.motion = undefined
      }
      const motion: ClawMotion = {
        ...options,
        from: { ...this.cartPosition, z: this.clawHeight },
        to,
        durationMs,
        elapsed: 0,
        complete: () => {
          cleanup()
          resolve()
        },
        cancel: (reason) => {
          cleanup()
          reject(reason)
        },
      }

      this.previous = { x: motion.from.x, y: motion.from.y }
      this.motion = motion
      signal?.addEventListener('abort', abort, { once: true })
      if (isReducedMotion()) {
        this.advanceMotion(durationMs)
        this.render()
      }
    })
  }

  /** Разделяет кадровый шаг в момент срыва, поэтому действие получает точную позу маршрута. */
  private advanceMotion(deltaMs: number): void {
    const { motion } = this

    if (!motion) return

    if (motion.elapsed === motion.durationMs) {
      this.advanceSwing(deltaMs)
      if (this.isSwingSettled()) motion.complete()
      return
    }

    const until = Math.min(motion.elapsed + deltaMs, motion.durationMs)
    const dropAt = motion.drop && motion.durationMs * easeTrapezoidInverse(motion.drop.share, CLAW_RAMP_SHARE)

    if (motion.drop && dropAt !== undefined && dropAt <= until) {
      const { drop } = motion

      motion.drop = undefined
      this.applyMotion(motion, dropAt)
      drop.onDrop(this.getGripPoint())
    }

    this.applyMotion(motion, until)
    if (until === motion.durationMs && (!motion.settleSwing || this.isSwingSettled())) motion.complete()
  }

  private applyMotion(motion: ClawMotion, elapsed: number): void {
    const deltaMs = elapsed - motion.elapsed
    const share = easeTrapezoid(elapsed / motion.durationMs, CLAW_RAMP_SHARE)
    this.cartPosition = {
      x: lerp(motion.from.x, motion.to.x, share),
      y: lerp(motion.from.y, motion.to.y, share),
    }
    this.clawHeight = lerp(motion.from.z, motion.to.z, share)

    motion.elapsed = elapsed
    this.advanceSwing(deltaMs)
    motion.onProgress?.(share, this.getGripPoint())
  }

  private isSwingSettled(): boolean {
    return (
      this.swing.x.value === 0 && this.swing.x.velocity === 0 && this.swing.y.value === 0 && this.swing.y.velocity === 0
    )
  }
}
