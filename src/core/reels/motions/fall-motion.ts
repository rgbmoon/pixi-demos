import type { ReelStrip } from 'src/core/reels/reel-strip'
import { type FallPlan, ReelPhase } from 'src/core/reels/types'

import type { FallingSlot, ReelMotion } from './types'

/**
 * Падение каскада: каждый падающий слот перемещается по своему пути из `FallPlan`. На последнем кадре
 * слоты ставятся точно на ряды, и их позиции становятся базами ленты.
 */
export class FallMotion<TValue> implements ReelMotion {
  readonly phase = ReelPhase.falling

  private readonly strip: ReelStrip<TValue>
  private readonly plan: FallPlan
  private readonly slots: readonly FallingSlot[]
  private elapsed = 0
  private done = false

  constructor(strip: ReelStrip<TValue>, plan: FallPlan, slots: readonly FallingSlot[]) {
    this.strip = strip
    this.plan = plan
    this.slots = slots
  }

  advance(deltaFrames: number): void {
    this.elapsed += deltaFrames

    if (this.elapsed < this.plan.totalFrames) {
      this.slots.forEach(({ slotIndex, from }, drop) =>
        this.strip.place(slotIndex, from + this.plan.positionAt(drop, this.elapsed))
      )

      return
    }

    this.slots.forEach(({ slotIndex, to }) => this.strip.place(slotIndex, to))
    this.strip.rebase()

    this.done = true
  }

  /** Переводит время падения к `settleFrames` — кадру касания последнего слота; отскок проигрывается. */
  slam(): void {
    this.elapsed = Math.max(this.elapsed, this.plan.settleFrames)
  }

  isDone(): boolean {
    return this.done
  }
}
