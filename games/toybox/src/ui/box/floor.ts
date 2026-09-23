import { Container, Graphics } from 'pixi.js'

import { GRID_ALPHA, GRID_SIZE, LINE_THICKNESS, TRAY_ALPHA } from '#src/constants'
import { getFaceOutline, getTrayOutline } from '#src/utils/grid'
import { worldToScreen } from '#src/utils/projection'
import { PALETTE } from '@pixi-demos/core/palette'

/**
 * Дно куба: контур нижней грани, линии сетки 8×8 и залитый квадрант лотка.
 * Лежит под клешнёй и её тенью — всё содержимое куба рисуется поверх него.
 */
export class Floor extends Container {
  constructor() {
    super()

    this.addChild(this.createTray(), this.createGrid(), this.createOutline())
  }

  private createOutline(): Graphics {
    const points = getFaceOutline(0).map((point) => worldToScreen(point))

    return new Graphics().poly(points).stroke({ width: LINE_THICKNESS, color: PALETTE.primary })
  }

  /** Линии сетки: по линии на каждую границу ячейки вдоль обеих осей. */
  private createGrid(): Graphics {
    const grid = new Graphics()

    for (let index = 0; index <= GRID_SIZE; index++) {
      const alongX = [worldToScreen({ x: index, y: 0, z: 0 }), worldToScreen({ x: index, y: GRID_SIZE, z: 0 })]
      const alongY = [worldToScreen({ x: 0, y: index, z: 0 }), worldToScreen({ x: GRID_SIZE, y: index, z: 0 })]

      grid.moveTo(alongX[0].x, alongX[0].y).lineTo(alongX[1].x, alongX[1].y)
      grid.moveTo(alongY[0].x, alongY[0].y).lineTo(alongY[1].x, alongY[1].y)
    }

    return grid.stroke({ width: LINE_THICKNESS, color: PALETTE.primary, alpha: GRID_ALPHA })
  }

  private createTray(): Graphics {
    const corners = getTrayOutline().map((point) => worldToScreen(point))

    return new Graphics().poly(corners).fill({ color: PALETTE.accent, alpha: TRAY_ALPHA })
  }
}
