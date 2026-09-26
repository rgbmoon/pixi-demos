import { Container, Graphics } from 'pixi.js'

import { LINE_THICKNESS } from '#src/constants'
import type { ScreenPoint, WorldPoint } from '#src/types'
import { snapToArtPixel, worldToScreen } from '#src/utils/projection'
import { PALETTE } from '@pixi-demos/core/palette'

/** Трос между мировыми точками каретки и клешни. */
export class Rope extends Container {
  private readonly line = new Graphics()
  /** Концы нарисованного отрезка на экране. */
  private top?: ScreenPoint
  private bottom?: ScreenPoint

  constructor() {
    super()

    this.addChild(this.line)
  }

  /** Перетягивает трос между точками мира; отрезок, совпадающий с нарисованным, не перерисовывается. */
  setSpan(from: WorldPoint, to: WorldPoint): void {
    const top = snapToArtPixel(worldToScreen(from))
    const bottom = snapToArtPixel(worldToScreen(to))

    if (Rope.isSame(this.top, top) && Rope.isSame(this.bottom, bottom)) return

    this.top = top
    this.bottom = bottom
    this.line
      .clear()
      .moveTo(top.x, top.y)
      .lineTo(bottom.x, bottom.y)
      .stroke({ width: LINE_THICKNESS, color: PALETTE.cyan })
  }

  private static isSame(drawn: ScreenPoint | undefined, next: ScreenPoint): boolean {
    return drawn?.x === next.x && drawn.y === next.y
  }
}
