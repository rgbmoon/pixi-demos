import { Container, Graphics } from 'pixi.js'

import { LINE_THICKNESS } from '#src/constants'
import { getCabinetOutlines, projectWorldOutline } from '#src/utils/machine-geometry'
import { PALETTE } from '@pixi-demos/core/palette'

/** Неподвижный корпус: фронтальная грань, правая боковина и наклонная панель управления. */
export class Cabinet extends Container {
  constructor() {
    super()

    const outline = new Graphics()

    for (const face of getCabinetOutlines()) {
      outline.poly(projectWorldOutline(face)).stroke({ color: PALETTE.primary, width: LINE_THICKNESS })
    }

    this.addChild(outline)
  }
}
