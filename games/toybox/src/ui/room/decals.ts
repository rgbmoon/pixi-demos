import { Assets, Container, Sprite, type Spritesheet, type Texture } from 'pixi.js'

import { ROOM_ATLAS, ROOM_SEQUENCES } from '#src/assets'
import { DECAL_BLOCK_SIZE } from '#src/constants'
import type { FrameSize, ScreenRect } from '#src/types'
import { getBlockDecals } from '#src/utils/room'

/** Декали стены: трещины и борозды. Раскладка идёт по блокам, состав блока задают его координаты. */
export class Decals extends Container {
  private readonly variants: Texture[]
  private readonly sizes: FrameSize[]
  /** Диапазон показанных блоков: при том же диапазоне раскладка не пересобирается. */
  private shownBlocks = ''

  constructor() {
    super()

    this.variants = Assets.get<Spritesheet>(ROOM_ATLAS).animations[ROOM_SEQUENCES.decals]
    this.sizes = this.variants.map(({ width, height }) => ({ width, height }))
  }

  /** Раскладывает декали по блокам, которые пересекают прямоугольник стены; его нижний край — верх панели. */
  cover({ left, top, right, bottom }: ScreenRect): void {
    const first = Math.floor(left / DECAL_BLOCK_SIZE)
    const last = Math.floor((right - 1) / DECAL_BLOCK_SIZE)
    const rows = Math.max(0, Math.ceil((bottom - top) / DECAL_BLOCK_SIZE))
    const blocks = `${first}:${last}:${rows}:${bottom}`

    if (blocks === this.shownBlocks) return

    this.shownBlocks = blocks

    for (const child of this.removeChildren()) child.destroy()

    for (let column = first; column <= last; column++) {
      for (let row = 0; row < rows; row++) {
        for (const { variant, x, y } of getBlockDecals(column, row, this.sizes)) {
          const sprite = new Sprite(this.variants[variant])

          sprite.position.set(x, bottom + y)
          this.addChild(sprite)
        }
      }
    }
  }
}
