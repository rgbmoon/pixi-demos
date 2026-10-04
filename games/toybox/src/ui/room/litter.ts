import { Assets, Container, Sprite } from 'pixi.js'

import { ART_PIXEL } from '#src/constants'
import type { LitterPlacement } from '#src/types'
import { snapToArtPixel, worldToScreen } from '#src/utils/projection'

/** Неподвижные предметы зала: спрайт кадра атласа стоит опорной точкой в своей точке мира, дальние лежат под ближними. */
export class Litter extends Container {
  constructor(placements: readonly LitterPlacement[]) {
    super()

    const sprites = placements.map(({ frame, point }) => {
      const sprite = new Sprite(Assets.get(frame))

      sprite.scale.set(ART_PIXEL)
      sprite.position.copyFrom(snapToArtPixel(worldToScreen(point)))

      return sprite
    })

    // Выше на экране — дальше от игрока
    this.addChild(...sprites.sort((a, b) => a.y - b.y))
  }
}
