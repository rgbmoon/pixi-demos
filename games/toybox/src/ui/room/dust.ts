import { Container, Sprite, Texture } from 'pixi.js'

import {
  DUST_COLOR,
  DUST_COUNT,
  DUST_DRIFT_SPEED,
  DUST_FALL_SPEED,
  DUST_MAX_LIFE_MS,
  DUST_MIN_LIFE_MS,
  DUST_SEED,
} from '#src/constants'
import type { DustMote, ScreenRect } from '#src/types'
import { createRandom } from '@pixi-demos/core/random'

/** Пылинки в свете автомата: оседают и дрейфуют в области `area`, разгораются и гаснут за срок жизни. */
export class Dust extends Container {
  private readonly area: ScreenRect
  private readonly random = createRandom(DUST_SEED)
  private readonly motes: DustMote[] = []
  private readonly sprites: Sprite[] = []

  constructor(area: ScreenRect) {
    super()

    this.area = area

    for (let index = 0; index < DUST_COUNT; index++) {
      const sprite = new Sprite({ texture: Texture.WHITE, width: 1, height: 1, tint: DUST_COLOR, blendMode: 'add' })
      const mote = this.spawn()

      // Первые пылинки уже в полёте: иначе все загорятся одновременно
      mote.age = this.random() * mote.life
      this.motes.push(mote)
      this.sprites.push(sprite)
      this.addChild(sprite)
    }

    this.sync()
  }

  /** Сдвигает пылинки на `deltaMs`; догоревшая пылинка появляется заново в случайном месте области. */
  advance(deltaMs: number): void {
    for (const [index, mote] of this.motes.entries()) {
      mote.age += deltaMs
      mote.x += (mote.vx * deltaMs) / 1000
      mote.y += (mote.vy * deltaMs) / 1000

      if (mote.age >= mote.life) this.motes[index] = this.spawn()
    }

    this.sync()
  }

  private spawn(): DustMote {
    const { left, top, right, bottom } = this.area

    return {
      x: left + this.random() * (right - left),
      y: top + this.random() * (bottom - top),
      vx: (this.random() * 2 - 1) * DUST_DRIFT_SPEED,
      vy: (0.25 + this.random() * 0.75) * DUST_FALL_SPEED,
      age: 0,
      life: DUST_MIN_LIFE_MS + this.random() * (DUST_MAX_LIFE_MS - DUST_MIN_LIFE_MS),
    }
  }

  /** Переносит пылинки в спрайты: место округляется до пикселя арта, яркость растёт к середине срока жизни. */
  private sync(): void {
    for (const [index, { x, y, age, life }] of this.motes.entries()) {
      const sprite = this.sprites[index]

      sprite.position.set(Math.round(x), Math.round(y))
      sprite.alpha = Math.sin((Math.PI * Math.min(age, life)) / life)
    }
  }
}
