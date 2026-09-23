import { Container, Graphics, Matrix, Text } from 'pixi.js'

import {
  CELL_SIZE,
  HUD_FONT_FAMILY,
  LINE_THICKNESS,
  MARQUEE_TEXT_CENTER,
  TRAY_ALPHA,
} from '#src/constants'
import { CABINET_FRONT_PLANE, getMarqueeOutlines, projectPlaneOffset } from '#src/utils/machine-geometry'
import { worldToScreen } from '#src/utils/projection'
import { PALETTE } from '@pixi-demos/core/palette'

/** Контурное табло, построенное в тех же мировых осях, что и стеклянный бокс. */
export class Marquee extends Container {
  private readonly message: Text

  constructor() {
    super()

    const outline = new Graphics()

    for (const face of getMarqueeOutlines()) {
      outline
        .poly(face.map((point) => worldToScreen(point)))
        .fill({ color: PALETTE.accent, alpha: TRAY_ALPHA })
        .stroke({ color: PALETTE.primary, width: LINE_THICKNESS })
    }

    this.message = new Text({
      text: 'WELCOME',
      style: {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: 32,
        fontWeight: 'bold',
        fill: PALETTE.white,
        align: 'center',
      },
      anchor: 0.5,
    })

    const horizontal = projectPlaneOffset(CABINET_FRONT_PLANE, CELL_SIZE, 0)
    const vertical = projectPlaneOffset(CABINET_FRONT_PLANE, 0, CELL_SIZE)
    const center = worldToScreen(MARQUEE_TEXT_CENTER)

    this.message.setFromMatrix(
      new Matrix(
        horizontal.x / CELL_SIZE,
        horizontal.y / CELL_SIZE,
        vertical.x / CELL_SIZE,
        vertical.y / CELL_SIZE,
        center.x,
        center.y
      )
    )

    this.addChild(outline, this.message)
  }

  /** Выводит текст на переднюю грань табло. */
  setMessage(message: string): void {
    this.message.text = message
  }

  /** Текст, выведенный на табло. */
  getMessage(): string {
    return this.message.text
  }
}
