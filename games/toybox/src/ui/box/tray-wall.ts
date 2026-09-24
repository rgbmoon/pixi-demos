import { Graphics } from 'pixi.js'

import { LINE_THICKNESS, TRAY_WALL_FILL_ALPHA } from '#src/constants'
import type { WorldPoint } from '#src/types'
import { worldToScreen } from '#src/utils/projection'
import { PALETTE } from '@pixi-demos/core/palette'

/**
 * Грань стенки лотка, которой он отгорожен от куба изнутри. У двух других граней стенкой служит сам куб,
 * и они не рисуются. Заливка почти непрозрачна: нужно чтобы видеть игрушки за стенкой лотка
 */
export class TrayWall extends Graphics {
  constructor(outline: readonly WorldPoint[]) {
    super()

    this.poly(outline.map((point) => worldToScreen(point)))
      .fill({ color: PALETTE.background, alpha: TRAY_WALL_FILL_ALPHA })
      .stroke({ width: LINE_THICKNESS, color: PALETTE.accent })
  }
}
