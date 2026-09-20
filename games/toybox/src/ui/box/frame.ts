import { Graphics } from 'pixi.js'

import { CUBE_HEIGHT, LINE_THICKNESS } from '#src/constants'
import { getFaceOutline, worldToScreen } from '#src/utils'
import { PALETTE } from '@pixi-demos/core/palette'

/**
 * Верхняя грань куба. Рисуется под содержимым: выше неё поднимается только каретка клешни.
 * Вертикальные рёбра в каркас не входят — они сортируются вместе с содержимым.
 */
export class Frame extends Graphics {
  constructor() {
    super()

    const points = getFaceOutline(CUBE_HEIGHT).map((point) => worldToScreen(point))

    this.poly(points).stroke({ width: LINE_THICKNESS, color: PALETTE.primary, pixelLine: true })
  }
}
