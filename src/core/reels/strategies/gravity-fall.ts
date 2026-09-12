import type { FallContext, FallPlan, FallStrategy } from 'src/core/reels/types'

import type { GravityFallOptions } from './types'

/**
 * Падение каскада под постоянным ускорением с коротким отскоком после касания ряда.
 * Барабаны стартуют лесенкой, внутри барабана нижний слот стартует первым: так верхний слот
 * не догоняет нижний.
 */
export class GravityFallStrategy implements FallStrategy {
  private readonly options: GravityFallOptions

  constructor(options: GravityFallOptions) {
    this.options = options
  }

  plan(context: FallContext): FallPlan {
    const { gravity, staggerFrames, rowStaggerFrames, bounceCells = 0, bounceFrames = 0 } = this.options
    const { order, drops, cellHeight } = context

    const bottomRow = Math.max(...drops.map((drop) => drop.row))
    const delays = drops.map((drop) => order * staggerFrames + (bottomRow - drop.row) * rowStaggerFrames)
    // Путь из покоя под ускорением: d = g·t²/2
    const fallFrames = drops.map((drop) => Math.sqrt((2 * drop.distance) / gravity))
    const settleFrames = Math.max(0, ...drops.map((_, index) => delays[index] + fallFrames[index]))
    const bounceHeight = bounceCells * cellHeight
    const hasBounce = bounceHeight > 0 && bounceFrames > 0

    return {
      totalFrames: settleFrames + (hasBounce ? bounceFrames : 0),
      settleFrames,
      positionAt: (drop: number, frames: number): number => {
        const { distance } = drops[drop]
        const elapsed = frames - delays[drop]

        if (elapsed <= 0) return 0

        if (elapsed < fallFrames[drop]) return (gravity * elapsed ** 2) / 2

        const bounceElapsed = elapsed - fallFrames[drop]

        if (!hasBounce || bounceElapsed >= bounceFrames) return distance

        return distance - bounceHeight * Math.sin((Math.PI * bounceElapsed) / bounceFrames)
      },
    }
  }
}
