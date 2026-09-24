import { Container, Graphics } from 'pixi.js'

import { CART_SIZE, LINE_THICKNESS } from '#src/constants'
import type { WorldPoint } from '#src/types'
import { worldToScreen } from '#src/utils/projection'
import { PALETTE } from '@pixi-demos/core/palette'

/**
 * Каретка: ездит по верхней грани куба и несёт клешню на тросе. Квадрат размечен в осях поля,
 * поэтому лежит в плоскости грани, а не стоит к ней углом.
 */
export class Cart extends Container {
  constructor() {
    super()

    const half = CART_SIZE / 2
    const corners = [
      { x: half, y: half, z: 0 },
      { x: half, y: -half, z: 0 },
      { x: -half, y: -half, z: 0 },
      { x: -half, y: half, z: 0 },
    ].map((corner) => worldToScreen(corner))

    this.addChild(
      new Graphics().poly(corners).stroke({ width: LINE_THICKNESS, color: PALETTE.cyan })
    )
  }

  /** Ставит каретку в точку мира. */
  setWorld(point: WorldPoint): void {
    const { x, y } = worldToScreen(point)

    this.position.set(x, y)
  }
}
