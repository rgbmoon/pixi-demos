import { Graphics } from 'pixi.js'

import { GRID_ALPHA, GRID_SIZE, LINE_THICKNESS, TRAY_ALPHA } from '#src/constants'
import { getFaceOutline, getTrayOutline } from '#src/utils/machine-geometry'
import { worldToScreen } from '#src/utils/projection'
import { PALETTE } from '@pixi-demos/core/palette'

/**
 * Дно куба: контур нижней грани, линии сетки 8×8 и место под лоток.
 */
export class Floor extends Graphics {
  constructor() {
    super()

    this.drawTray()
    this.drawGrid()
    this.drawOutline()
  }

  private drawOutline(): void {
    const points = getFaceOutline(0).map((point) => worldToScreen(point))

    this.poly(points).stroke({ width: LINE_THICKNESS, color: PALETTE.primary })
  }

  /** Линии сетки: по линии на каждую границу ячейки вдоль обеих осей. */
  private drawGrid(): void {
    for (let index = 0; index <= GRID_SIZE; index++) {
      const alongX = [worldToScreen({ x: index, y: 0, z: 0 }), worldToScreen({ x: index, y: GRID_SIZE, z: 0 })]
      const alongY = [worldToScreen({ x: 0, y: index, z: 0 }), worldToScreen({ x: GRID_SIZE, y: index, z: 0 })]

      this.moveTo(alongX[0].x, alongX[0].y).lineTo(alongX[1].x, alongX[1].y)
      this.moveTo(alongY[0].x, alongY[0].y).lineTo(alongY[1].x, alongY[1].y)
    }

    this.stroke({ width: LINE_THICKNESS, color: PALETTE.primary, alpha: GRID_ALPHA })
  }

  private drawTray(): void {
    const corners = getTrayOutline().map((point) => worldToScreen(point))

    this.poly(corners).fill({ color: PALETTE.accent, alpha: TRAY_ALPHA })
  }
}
