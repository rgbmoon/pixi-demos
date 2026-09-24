import { injectable } from 'inversify'

import { CART_SIZE, CLAW_GRAB_MS, CLAW_RAMP_SHARE, CUBE_HEIGHT, FIELD_CENTER } from '#src/constants'
import type { ClawDrop, GroundPoint, WorldPoint } from '#src/types'
import { clampToField } from '#src/utils/machine-geometry'
import { lerp } from '#src/utils/math'
import { isReducedMotion } from '@pixi-demos/core/accessibility'
import { easeTrapezoid, easeTrapezoidInverse } from '@pixi-demos/core/easing'
import { createAbortError } from '@pixi-demos/core/errors/utils'

import {
  CLAW_DROP_MS,
  CLAW_LIFT_MS,
  CLAW_MAX_SPEED,
  CLAW_REST_HEIGHT,
  CLAW_TRAVEL_SPEED,
  MIN_TRAVEL_MS,
  SWAY_DAMPING,
  SWAY_DRAG,
  SWAY_MAX_OFFSET,
  SWAY_PERIOD_MS,
} from './constants'
import type { ClawMotion, ClawMotionOptions, SpringState } from './types'
import { advanceSpring, advanceVelocity } from './utils'

/**
 * Модель клешни: положение каретки, высота клешни, скорость по вводу игрока, качание на тросе и движения фаз.
 * Команды фаз возвращают промис конца движения, кадровый шаг `advance` продвигает модель; при уменьшенном
 * движении команда завершается в самом вызове.
 */
@injectable()
export class ClawRig {
  private cartPosition: GroundPoint = FIELD_CENTER
  private clawHeight = CLAW_REST_HEIGHT
  private velocity: GroundPoint = { x: 0, y: 0 }
  /** Отклонение клешни от каретки по осям поля: маятник на тросе, по пружине на ось. */
  private swing: { x: SpringState; y: SpringState } = { x: { value: 0, velocity: 0 }, y: { value: 0, velocity: 0 } }
  /** Предыдущее положение каретки для расчёта скорости, вызывающей качание клешни. */
  private previous: GroundPoint = FIELD_CENTER
  private motion?: ClawMotion

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

  /** Проигрывает захват на месте за `CLAW_GRAB_MS`. */
  async grab(signal: AbortSignal): Promise<void> {
    await this.tween({ ...this.cartPosition, z: this.clawHeight }, CLAW_GRAB_MS, signal)
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

  /**
   * Кадровый шаг: движение фазы, а без него ход каретки по вводу `direction`. Качание клешни идёт при любом
   * её движении; пока идёт движение фазы, ввод игрока не применяется.
   */
  advance(deltaMs: number, direction: GroundPoint): void {
    if (this.motion) {
      this.advanceMotion(isReducedMotion() ? this.motion.durationMs : deltaMs)
    } else {
      this.drive(deltaMs, direction)
      this.advanceSwing(deltaMs)
    }
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

  /** Кадровый ход каретки по вводу игрока. */
  private drive(deltaMs: number, direction: GroundPoint): void {
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
      if (isReducedMotion()) this.advanceMotion(durationMs)
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
  }

  private isSwingSettled(): boolean {
    return (
      this.swing.x.value === 0 && this.swing.x.velocity === 0 && this.swing.y.value === 0 && this.swing.y.velocity === 0
    )
  }
}
