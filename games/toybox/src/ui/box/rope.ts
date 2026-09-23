import { Container, Graphics } from 'pixi.js'

import { LINE_THICKNESS } from '#src/constants'
import type { WorldPoint } from '#src/types'
import { worldToScreen } from '#src/utils/projection'
import { PALETTE } from '@pixi-demos/core/palette'

/**
 * Трос между мировыми точками каретки и клешни. Контроллер обновляет отрезок
 * при изменении положения или отклонения клешни.
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
      .stroke({ width: LINE_THICKNESS, color: PALETTE.cyan })
  }
}
