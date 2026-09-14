import type { ReelStrip } from 'src/core/reels/reel-strip'
import { ReelPhase, type ReelContext, type SpinStrategy, type StripSlot } from 'src/core/reels/types'

import type { ReelMotion } from './types'

/** Прокрутка без конца: каждый кадр лента сдвигается на шаг `SpinStrategy`, перенесённые слоты получают наполнение. */
export class SpinMotion<TValue> implements ReelMotion {
  readonly phase = ReelPhase.spinning

  private readonly strip: ReelStrip<TValue>
  private readonly strategy: SpinStrategy
  private readonly context: ReelContext
  private readonly onWrap: (slot: StripSlot<TValue>) => void
  /** Кадры прокрутки с её начала: посадка учитывает их в минимуме вращения. */
  private spunFrames = 0

  constructor(
    strip: ReelStrip<TValue>,
    strategy: SpinStrategy,
    context: ReelContext,
    onWrap: (slot: StripSlot<TValue>) => void
  ) {
    this.strip = strip
    this.strategy = strategy
    this.context = context
    this.onWrap = onWrap
  }

  getSpunFrames(): number {
    return this.spunFrames
  }

  advance(deltaFrames: number): void {
    this.spunFrames += deltaFrames

    this.strip.moveTo(this.strip.getOffset() + this.strategy.step(deltaFrames, this.context), this.onWrap)
  }

  slam(): void {
    // У прокрутки нет финального участка
  }

  isDone(): boolean {
    return false
  }
}
