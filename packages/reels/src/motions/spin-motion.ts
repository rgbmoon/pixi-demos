import type { ReelStrip } from '#src/reel-strip'
import { ReelPhase, type SpinPlan, type StripSlot } from '#src/types'

import type { ReelMotion } from './types'

/** Прокрутка без конца: позиция ленты на каждом кадре берётся из `SpinPlan`, перенесённые слоты получают наполнение. */
export class SpinMotion<TValue> implements ReelMotion {
  readonly phase = ReelPhase.spinning

  private readonly strip: ReelStrip<TValue>
  private readonly plan: SpinPlan
  private readonly start: number
  private readonly onWrap: (slot: StripSlot<TValue>) => void
  /** Кадры прокрутки с её начала: посадка учитывает их в минимуме вращения. */
  private elapsed = 0

  constructor(strip: ReelStrip<TValue>, plan: SpinPlan, onWrap: (slot: StripSlot<TValue>) => void) {
    this.strip = strip
    this.plan = plan
    this.start = strip.getOffset()
    this.onWrap = onWrap
  }

  getSpunFrames(): number {
    return this.elapsed
  }

  advance(deltaFrames: number): void {
    this.elapsed += deltaFrames

    this.strip.moveTo(this.start + this.plan.positionAt(this.elapsed), this.onWrap)
  }

  slam(): void {
    // У прокрутки нет финального участка
  }

  isDone(): boolean {
    return false
  }
}
