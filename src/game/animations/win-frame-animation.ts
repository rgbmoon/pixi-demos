import { Container, Graphics } from 'pixi.js'
import { PALETTE } from 'src/constants/palette'

import { CELL_HEIGHT, CELL_WIDTH, WIN_FRAME_INSET, WIN_FRAME_RADIUS, WIN_FRAME_THICKNESS } from '../constants'

/** Рамка выигравшей ячейки: обводка по её границам, готового арта под неё в паке нет. */
export class WinFrameAnimation {
  readonly view = new Container()

  constructor() {
    const width = CELL_WIDTH - WIN_FRAME_INSET * 2
    const height = CELL_HEIGHT - WIN_FRAME_INSET * 2

    const frame = new Graphics()
      .roundRect(-width / 2, -height / 2, width, height, WIN_FRAME_RADIUS)
      .stroke({ width: WIN_FRAME_THICKNESS, color: PALETTE.gold })

    this.view.visible = false
    this.view.addChild(frame)
  }

  show(): void {
    this.view.visible = true
  }

  hide(): void {
    this.view.visible = false
  }
}
