import { Container } from 'pixi.js'

import { CABINET_FRAMES } from '#src/assets'
import { Face } from '#src/ui/box/face'
import { getCabinetFaces } from '#src/utils/machine-geometry'

/** Неподвижный корпус: фасад тумбы, правая боковина и наклонная панель управления. */
export class Cabinet extends Container {
  constructor() {
    super()

    const faces = getCabinetFaces()

    // Боковина лежит под панелью: её угол над наклоном панели закрывает панель
    this.addChild(
      new Face(CABINET_FRAMES.cabinetSide, faces.cabinetSide),
      new Face(CABINET_FRAMES.cabinetFront, faces.cabinetFront),
      new Face(CABINET_FRAMES.panel, faces.panel)
    )
  }
}
