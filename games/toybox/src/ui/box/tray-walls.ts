import { Container, Graphics } from 'pixi.js'

import { LINE_THICKNESS, TRAY_ORIGIN, TRAY_SIZE } from '#src/constants'
import { getDepthOrder, getTrayWallOutlines, worldToScreen } from '#src/utils'
import { PALETTE } from '@pixi-demos/core/palette'

/**
 * Стенки лотка: две грани, которыми он отгорожен от куба изнутри. У двух других граней стенкой
 * служит сам куб, и они не рисуются. Заливка непрозрачна, поэтому куча за лотком не просвечивает.
 *
 * Наложение считается наравне с игрушками: место в глубине задаёт внутренний угол лотка — то,
 * что лежит за ним, стенки закрывают, а всё в самом лотке к игроку ближе и проходит перед ними.
 */
export class TrayWalls extends Container {
  constructor() {
    super()

    this.zIndex = getDepthOrder({ x: TRAY_ORIGIN.col + TRAY_SIZE, y: TRAY_ORIGIN.row, z: 0 })

    for (const outline of getTrayWallOutlines()) {
      const points = outline.map((point) => worldToScreen(point))

      this.addChild(
        new Graphics()
          .poly(points)
          .fill({ color: PALETTE.background })
          .stroke({ width: LINE_THICKNESS, color: PALETTE.accent, pixelLine: true })
      )
    }
  }
}
