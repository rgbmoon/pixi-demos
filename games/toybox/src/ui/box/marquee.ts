import { Container, Matrix, Text } from 'pixi.js'

import { CABINET_FRAMES } from '#src/assets'
import { CABINET_FRONT_PLANE, CELL_SIZE, HUD_FONT_FAMILY, MARQUEE_TEXT_CENTER } from '#src/constants'
import { Face } from '#src/ui/box/face'
import { getCabinetFaces } from '#src/utils/machine-geometry'
import { projectPlaneOffset, worldToScreen } from '#src/utils/projection'
import { PALETTE } from '@pixi-demos/core/palette'

/**
 * Крыша автомата с экраном для вывода текста и символов
 * TODO сделать вывод текста бегущей строкой
 */
export class Marquee extends Container {
  private readonly message: Text

  constructor() {
    super()

    const faces = getCabinetFaces()

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

    this.addChild(
      new Face(CABINET_FRAMES.marqueeRoof, faces.marqueeRoof),
      new Face(CABINET_FRAMES.marqueeSide, faces.marqueeSide),
      new Face(CABINET_FRAMES.marqueeFront, faces.marqueeFront),
      new Face(CABINET_FRAMES.marqueeScreen, faces.marqueeScreen),
      this.message
    )
  }

  /** Выводит текст на переднюю грань табло. */
  setMessage(message: string): void {
    this.message.text = message
  }
}
