import { inject, injectable } from 'inversify'
import type { DestroyOptions, Ticker } from 'pixi.js'

import {
  CLAW_DROP_MS,
  CLAW_LIFT_MS,
  CLAW_MAX_SPEED,
  CLAW_RAMP_SHARE,
  CLAW_TRAVEL_SPEED,
  CUBE_HEIGHT,
  FIELD_CENTER,
} from '#src/constants'
import type { GroundPoint, ScreenPoint, WorldPoint } from '#src/types'
import { Claw } from '#src/ui/box/claw'
import { ClawShadow } from '#src/ui/box/claw-shadow'
import { advanceVelocity, clampToField, toGroundDirection } from '#src/utils'
import { easeTrapezoid } from '@pixi-demos/core/easing'
import { createAbortError } from '@pixi-demos/core/errors/utils'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/** Минимальная длительность перемещения: нужна чтобы не допустить деление на ноль при расчете */
const MIN_TRAVEL_MS = 1

/**
 * Клешня и её тень: держит положение в кубе и ведёт его на игровом тикере.
 * Ход по джойстику свободный — направление приходит в `setDirection`, скорость набирается
 * и гаснет сама. Движения цикла (`moveTo`, `descend`, `ascend`) возвращают промис, их ждут фазы
 * и на время их хода ввод игрока не применяется.
 */
@injectable()
export class ClawController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly claw = new Claw()
  private readonly shadow = new ClawShadow()
  private point: WorldPoint = { ...FIELD_CENTER, z: CUBE_HEIGHT }
  private velocity: GroundPoint = { x: 0, y: 0 }
  private direction: GroundPoint = { x: 0, y: 0 }
  private motion?: AbortController

  constructor(@inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker) {
    super()

    this.ticker = ticker

    this.addChild(this.shadow, this.claw)
    this.apply(this.point)

    this.ticker.add(this.step)
  }

  override destroy(options?: DestroyOptions): void {
    this.ticker.remove(this.step)
    this.motion?.abort(createAbortError('Claw destroyed'))

    super.destroy(options)
  }

  /** Точка поля под клешнёй. */
  getPosition(): GroundPoint {
    return { x: this.point.x, y: this.point.y }
  }

  /** Принимает отклонение джойстика в экранных осях: его длина задаёт долю предельной скорости. */
  setDirection(vector: ScreenPoint): void {
    this.direction = toGroundDirection(vector)
  }

  /** Ведёт клешню к точке поля, сохраняя высоту. */
  async moveTo(target: GroundPoint, signal?: AbortSignal): Promise<void> {
    const distance = Math.hypot(target.x - this.point.x, target.y - this.point.y)
    const durationMs = Math.max((distance / CLAW_TRAVEL_SPEED) * 1000, MIN_TRAVEL_MS)

    await this.tween({ ...target, z: this.point.z }, durationMs, signal)
  }

  /** Опускает клешню до пола. */
  async descend(signal?: AbortSignal): Promise<void> {
    await this.tween({ ...this.point, z: 0 }, CLAW_DROP_MS, signal)
  }

  /** Поднимает клешню к верхней грани. */
  async ascend(signal?: AbortSignal): Promise<void> {
    await this.tween({ ...this.point, z: CUBE_HEIGHT }, CLAW_LIFT_MS, signal)
  }

  /** Кадровый ход по джойстику. Пока идёт движение фазы, ввод игрока не применяется. */
  private step = (ticker: Ticker): void => {
    if (this.motion) return

    const target = { x: this.direction.x * CLAW_MAX_SPEED, y: this.direction.y * CLAW_MAX_SPEED }

    this.velocity = advanceVelocity(this.velocity, target, ticker.deltaMS)

    if (this.velocity.x === 0 && this.velocity.y === 0) return

    const seconds = ticker.deltaMS / 1000
    const next = { x: this.point.x + this.velocity.x * seconds, y: this.point.y + this.velocity.y * seconds }
    const moved = clampToField(next)

    // У стенки скорость гасится: иначе клешня копит её и отходит от стенки рывком
    if (moved.x !== next.x) this.velocity.x = 0
    if (moved.y !== next.y) this.velocity.y = 0

    this.apply({ ...moved, z: this.point.z })
  }

  private apply(point: WorldPoint): void {
    this.point = point

    this.claw.setWorld(point)
    this.shadow.setWorld(point)
  }

  /** Точка пути между `from` и `to`: привод коротко разгоняется, идёт ровно и так же тормозит. */
  private interpolate(from: WorldPoint, to: WorldPoint, linearProgress: number): WorldPoint {
    const progress = easeTrapezoid(linearProgress, CLAW_RAMP_SHARE)

    return {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
      z: from.z + (to.z - from.z) * progress,
    }
  }

  /**
   * Ведёт положение клешни к точке за `durationMs` на игровом тикере: промис резолвится на последнем
   * кадре, реджектится по отмене — своей, внешнего `signal` или следующего движения.
   */
  private tween(to: WorldPoint, durationMs: number, signal?: AbortSignal): Promise<void> {
    this.motion?.abort(createAbortError('Claw motion replaced'))

    // Ход по джойстику обрывается: дальше клешню ведёт автомат
    this.velocity = { x: 0, y: 0 }
    this.direction = { x: 0, y: 0 }

    const motion = new AbortController()

    this.motion = motion

    if (signal?.aborted) {
      motion.abort(signal.reason)
    } else {
      signal?.addEventListener('abort', () => motion.abort(signal.reason), { once: true })
    }

    return new Promise<void>((resolve, reject) => {
      const from = this.point
      let elapsed = 0

      const settle = (finish: () => void) => {
        this.ticker.remove(step)
        motion.signal.removeEventListener('abort', handleAbort)

        if (this.motion === motion) this.motion = undefined

        finish()
      }

      const step = (ticker: Ticker) => {
        elapsed += ticker.deltaMS

        const progress = Math.min(elapsed / durationMs, 1)

        this.apply(this.interpolate(from, to, progress))

        if (progress === 1) settle(resolve)
      }

      const handleAbort = () => settle(() => reject(motion.signal.reason as Error))

      if (motion.signal.aborted) {
        settle(() => reject(motion.signal.reason as Error))

        return
      }

      // Движение клешни несёт смысл, но при prefers-reduced-motion она встаёт на место без хода
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.apply(to)
        settle(resolve)

        return
      }

      motion.signal.addEventListener('abort', handleAbort, { once: true })
      this.ticker.add(step)
    })
  }
}
