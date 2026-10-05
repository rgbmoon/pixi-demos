import { Graphics } from 'pixi.js'

import { ART_PIXEL } from '#src/constants'
import type { WorldPoint } from '#src/types'
import { getArtPolyline } from '#src/utils/room'

/** Кабель толщиной в пиксель арта по ломаной через точки мира. */
export class Cable extends Graphics {
  constructor(path: readonly WorldPoint[], color: string) {
    super()

    for (const { x, y } of getArtPolyline(path)) this.rect(x * ART_PIXEL, y * ART_PIXEL, ART_PIXEL, ART_PIXEL)
    this.fill(color)
  }
}
