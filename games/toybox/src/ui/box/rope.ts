import { Container, Graphics } from 'pixi.js'

import { LINE_THICKNESS } from '#src/constants'
import type { WorldPoint } from '#src/types'
import { worldToScreen } from '#src/utils'
import { PALETTE } from '@pixi-demos/core/palette'

/**
 * Трос: отрезок от каретки до клешни. Почти вертикален — качание отклоняет его нижний конец
 * на пару пикселей. Отрезок перерисовывается каждый кадр: поворот спрайта ломал бы пиксельную сетку.
 */
export class Rope extends Container {
  private readonly line = new Graphics()

  constructor() {
    super()

    this.addChild(this.line)
  }

  /** Перетягивает трос между точками мира. */
  setSpan(from: WorldPoint, to: WorldPoint): void {
    const top = worldToScreen(from)
    const bottom = worldToScreen(to)

    this.line
      .clear()
      .moveTo(top.x, top.y)
      .lineTo(bottom.x, bottom.y)
      .stroke({ width: LINE_THICKNESS, color: PALETTE.cyan, pixelLine: true })
  }
}
