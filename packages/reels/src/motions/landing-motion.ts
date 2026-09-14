import type { ReelStrip } from '#src/reel-strip'
import { type LandingPlan, ReelPhase, type StripSlot } from '#src/types'

import type { ReelMotion } from './types'

/**
 * Посадка: позиция ленты на каждом кадре берётся из `LandingPlan`, в конце лента выравнивается на границу
 * ячейки. Для перенесённого слота `onWrap` получает непройденный остаток пути.
 */
export class LandingMotion<TValue> implements ReelMotion {
  readonly phase = ReelPhase.landing

  private readonly strip: ReelStrip<TValue>
  private readonly plan: LandingPlan
  private readonly start: number
  private readonly onWrap: (slot: StripSlot<TValue>, remaining: number) => void
  private readonly onAnticipated?: () => void
  private elapsed = 0
  private done = false

  constructor(
    strip: ReelStrip<TValue>,
    plan: LandingPlan,
    onWrap: (slot: StripSlot<TValue>, remaining: number) => void,
    onAnticipated?: () => void
  ) {
    this.strip = strip
    this.plan = plan
    this.start = strip.getOffset()
    this.onWrap = onWrap
    this.onAnticipated = onAnticipated
  }

  advance(deltaFrames: number): void {
    const { plan } = this
    const previous = this.elapsed

    this.elapsed += deltaFrames

    // Начало паузы проверяется только здесь: slam меняет elapsed вне advance, промотанная пауза не объявляется
    if (plan.anticipationFrames !== undefined && previous < plan.anticipationFrames && this.elapsed >= plan.anticipationFrames) {
      this.onAnticipated?.()
    }

    const position = plan.positionAt(this.elapsed)
    const remaining = plan.distance - position

    this.strip.moveTo(this.start + position, (slot) => this.onWrap(slot, remaining))

    if (this.elapsed < plan.totalFrames) return

    this.strip.snap()

    this.done = true
  }

  /**
   * Переводит время посадки к `settleFrames`. План не меняется, поэтому перенесённые слоты получают значения
   * так же, как без промотки.
   */
  slam(): void {
    this.elapsed = Math.max(this.elapsed, this.plan.settleFrames)
  }

  isDone(): boolean {
    return this.done
  }
}
