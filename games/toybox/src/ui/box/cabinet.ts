import { Graphics } from 'pixi.js'

import { LINE_THICKNESS } from '#src/constants'
import { getCabinetOutlines } from '#src/utils/machine-geometry'
import { worldToScreen } from '#src/utils/projection'
import { PALETTE } from '@pixi-demos/core/palette'

/** Неподвижный корпус: фронтальная грань, правая боковина и наклонная панель управления. */
export class Cabinet extends Graphics {
  constructor() {
    super()

    for (const face of getCabinetOutlines()) {
      this.poly(face.map((point) => worldToScreen(point)))
        .fill(PALETTE.background)
        .stroke({ color: PALETTE.primary, width: LINE_THICKNESS })
    }
  }
}
