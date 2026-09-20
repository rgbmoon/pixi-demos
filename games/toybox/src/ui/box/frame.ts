import { Container, Graphics } from 'pixi.js'

import { CUBE_HEIGHT, LINE_THICKNESS } from '#src/constants'
import { getFaceOutline, worldToScreen } from '#src/utils'
import { PALETTE } from '@pixi-demos/core/palette'

/**
 * Рёбра куба: верхняя грань и четыре вертикальные стойки. Рисуется под содержимым куба: стойки
 * дальних углов обязаны уходить за кучу, а верхняя грань лежит выше всего, что стоит внутри.
 */
export class Frame extends Container {
  constructor() {
    super()

    this.addChild(this.createTop(), this.createPillars())
  }

  private createTop(): Graphics {
    const points = getFaceOutline(CUBE_HEIGHT).map((point) => worldToScreen(point))

    return new Graphics().poly(points).stroke({ width: LINE_THICKNESS, color: PALETTE.primary, pixelLine: true })
  }

  private createPillars(): Graphics {
    const pillars = new Graphics()

    for (const corner of getFaceOutline(0)) {
      const bottom = worldToScreen(corner)
      const top = worldToScreen({ ...corner, z: CUBE_HEIGHT })

      pillars.moveTo(bottom.x, bottom.y).lineTo(top.x, top.y)
    }

    return pillars.stroke({ width: LINE_THICKNESS, color: PALETTE.primary, pixelLine: true })
  }
}
