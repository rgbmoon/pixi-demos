import { Container, Graphics } from 'pixi.js'
import { PALETTE } from 'src/core/palette'
import { CELL_HEIGHT, CELL_WIDTH, WIN_FRAME_INSET, WIN_FRAME_THICKNESS } from 'src/games/slot/constants'

/** Рамка выигравшей ячейки: обводка по её границам, готового арта под неё в паке нет. */
export class WinFrame extends Container {
  constructor() {
    super()

    const width = CELL_WIDTH - WIN_FRAME_INSET * 2
    const height = CELL_HEIGHT - WIN_FRAME_INSET * 2

    const frame = new Graphics()
      .rect(-width / 2, -height / 2, width, height)
      .stroke({ width: WIN_FRAME_THICKNESS, color: PALETTE.cyan })

    this.visible = false
    this.addChild(frame)
  }

  show(): void {
    this.visible = true
  }

  hide(): void {
    this.visible = false
  }
}
