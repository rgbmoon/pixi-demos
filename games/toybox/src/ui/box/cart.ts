import { Container, Graphics } from 'pixi.js'

import { CART_SIZE, CART_THICKNESS } from '#src/constants'
import type { WorldPoint } from '#src/types'
import { getDepthScale, worldToScreen } from '#src/utils/projection'
import { PALETTE } from '@pixi-demos/core/palette'

/** Половина стороны каретки в ячейках: от неё считаются углы её квадрата. */
const HALF = CART_SIZE / 2

/**
 * Каретка: ездит по верхней грани куба и несёт клешню на тросе. Квадрат размечен в осях поля,
 * поэтому лежит в плоскости грани, а не стоит к ней углом.
 */
export class Cart extends Container {
  constructor() {
    super()

    const corners = [
      { x: HALF, y: HALF, z: 0 },
      { x: HALF, y: -HALF, z: 0 },
      { x: -HALF, y: -HALF, z: 0 },
      { x: -HALF, y: HALF, z: 0 },
    ].map((corner) => worldToScreen(corner))

    this.addChild(
      new Graphics().poly(corners).stroke({ width: CART_THICKNESS, color: PALETTE.cyan, pixelLine: true })
    )
  }

  /** Ставит каретку в точку мира; с глубиной она видна мельче. */
  setWorld(point: WorldPoint): void {
    const { x, y } = worldToScreen(point)

    this.position.set(x, y)
    this.scale.set(getDepthScale(point.x))
  }
}
