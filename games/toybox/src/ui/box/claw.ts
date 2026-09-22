import { Container, Graphics } from 'pixi.js'

import { CLAW_RADIUS } from '#src/constants'
import type { WorldPoint } from '#src/types'
import { getDepthScale, worldToScreen } from '#src/utils/projection'
import { PALETTE } from '@pixi-demos/core/palette'

/** Клешня: точка в объёме куба. Под ассетами станет покадровой анимацией, геометрия не изменится. */
export class Claw extends Container {
  constructor() {
    super()

    this.addChild(new Graphics().circle(0, 0, CLAW_RADIUS).fill({ color: PALETTE.cyan }))
  }

  /** Ставит клешню в точку мира; с глубиной она видна мельче. */
  setWorld(point: WorldPoint): void {
    const { x, y } = worldToScreen(point)

    this.position.set(x, y)
    this.scale.set(getDepthScale(point.x))
  }
}
