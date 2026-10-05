import { Assets, Sprite } from 'pixi.js'

import { ART_PIXEL } from '#src/constants'
import type { PropPlacement } from '#src/types'
import { snapToArtPixel, worldToScreen } from '#src/utils/projection'

/** Неподвижный предмет зала: спрайт кадра атласа стоит опорной точкой в своей точке мира. */
export class Prop extends Sprite {
  constructor({ frame, point }: PropPlacement) {
    super(Assets.get(frame))

    this.scale.set(ART_PIXEL)
    this.position.copyFrom(snapToArtPixel(worldToScreen(point)))
  }
}
