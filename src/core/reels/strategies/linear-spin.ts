import type { SpinStrategy } from 'src/core/reels/types'

import type { LinearSpinOptions } from './types'

/** Прокрутка с постоянной скоростью `speed` единиц за кадр. */
export class LinearSpinStrategy implements SpinStrategy {
  private readonly speed: number

  constructor(options: LinearSpinOptions) {
    this.speed = options.speed
  }

  step(deltaFrames: number): number {
    return this.speed * deltaFrames
  }
}
