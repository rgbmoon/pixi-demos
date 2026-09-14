import type { SpinPlan, SpinStrategy } from '#src/types'

import type { LinearSpinOptions } from './types'

/** Прокрутка с постоянной скоростью `speed` единиц за кадр. */
export class LinearSpinStrategy implements SpinStrategy {
  private readonly speed: number

  constructor(options: LinearSpinOptions) {
    this.speed = options.speed
  }

  plan(): SpinPlan {
    return { positionAt: (frames) => this.speed * frames }
  }
}
