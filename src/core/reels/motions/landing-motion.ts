import type { ReelStrip } from 'src/core/reels/strip'
import { type LandingPlan, ReelPhase, type StripSlot } from 'src/core/reels/types'

import type { ReelMotion } from './types'

/**
 * Посадка: лента идёт по расписанию стратегии от позиции, где её поймали, и встаёт на границу ячейки.
 * Обёрнутый слот получает значение по непройденному остатку пути.
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

    // Вход в паузу ловится только ходом ленты: slam двигает время вне advance и перескакивает его молча
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
   * Проматывает посадку к финальному участку расписания. План не меняется, двигается только время,
   * поэтому слоты получают значения раунда так же, как на обычной посадке.
   */
  slam(): void {
    this.elapsed = Math.max(this.elapsed, this.plan.settleFrames)
  }

  isDone(): boolean {
    return this.done
  }
}
