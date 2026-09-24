import { Graphics } from 'pixi.js'

import { LINE_THICKNESS } from '#src/constants'
import type { WorldPoint } from '#src/types'
import { worldToScreen } from '#src/utils/projection'
import { PALETTE } from '@pixi-demos/core/palette'

/**
 * Грань стенки лотка, которой он отгорожен от куба изнутри. У двух других граней стенкой служит сам куб,
 * и они не рисуются. Заливка непрозрачна, поэтому куча за лотком не просвечивает.
 */
export class TrayWall extends Graphics {
  constructor(outline: readonly WorldPoint[]) {
    super()

    this.poly(outline.map((point) => worldToScreen(point)))
      .fill({ color: PALETTE.background, alpha: 0.8 })
      .stroke({ width: LINE_THICKNESS, color: PALETTE.accent })
  }
}
