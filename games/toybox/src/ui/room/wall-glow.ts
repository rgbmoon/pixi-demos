import {
  WALL_GLOW_ALPHA,
  WALL_GLOW_DIPS,
  WALL_GLOW_MAX_PAUSE_MS,
  WALL_GLOW_MIN_PAUSE_MS,
  WALL_GLOW_SEED,
} from '#src/constants'
import type { LightStep } from '#src/types'
import { pickFlicker } from '#src/utils/light'
import { createRandom } from '@pixi-demos/core/random'

import { Glow } from './glow'

/** Ореол стеклянного куба на стене: изредка мерцает */
export class WallGlow extends Glow {
  /** Мерцание берёт свой генератор: оно не тратит `Math.random` игры. */
  private readonly random = createRandom(WALL_GLOW_SEED)
  private steps: readonly LightStep[] = []
  private step = 0
  private remainingMs = 0

  constructor(frame: string) {
    // Свет складывается с фоном: узор под пятном остаётся виден и светлеет
    super(frame, 'add')
  }

  /** Продвигает мерцание на `deltaMs`. */
  advance(deltaMs: number): void {
    this.remainingMs -= deltaMs

    while (this.remainingMs <= 0) {
      this.step += 1

      if (this.step >= this.steps.length) {
        this.steps = pickFlicker(this.random, WALL_GLOW_MIN_PAUSE_MS, WALL_GLOW_MAX_PAUSE_MS, WALL_GLOW_DIPS)
        this.step = 0
      }

      const [light, ms] = this.steps[this.step]

      this.alpha = WALL_GLOW_ALPHA[light]
      this.remainingMs += ms
    }
  }
}
