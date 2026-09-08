import type { SpinStrategy } from 'src/core/reels/types'

import type { LinearSpinOptions } from './types'

/** Равномерная прокрутка: лента идёт с постоянной скоростью, пока барабан не поймают. */
export class LinearSpinStrategy implements SpinStrategy {
  private readonly speed: number

  constructor(options: LinearSpinOptions) {
    this.speed = options.speed
  }

  step(deltaFrames: number): number {
    return this.speed * deltaFrames
  }
}
