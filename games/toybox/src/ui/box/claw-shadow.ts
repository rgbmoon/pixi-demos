import { Container, Graphics } from 'pixi.js'

import { CLAW_SHADOW_ALPHA, CLAW_SHADOW_RADIUS } from '#src/constants'
import type { WorldPoint } from '#src/types'
import { getDepthScale, worldToScreen } from '#src/utils'
import { PALETTE } from '@pixi-demos/core/palette'

/** Тень клешни: ответная точка на полу, показывает ячейку под клешнёй. */
export class ClawShadow extends Container {
  constructor() {
    super()

    this.addChild(
      new Graphics().circle(0, 0, CLAW_SHADOW_RADIUS).fill({ color: PALETTE.cyan, alpha: CLAW_SHADOW_ALPHA })
    )
  }

  /** Ставит тень под точку мира: высота отбрасывается, тень остаётся на полу. */
  setWorld({ x, y }: WorldPoint): void {
    const screen = worldToScreen({ x, y, z: 0 })

    this.position.set(screen.x, screen.y)
    this.scale.set(getDepthScale(x))
  }
}
