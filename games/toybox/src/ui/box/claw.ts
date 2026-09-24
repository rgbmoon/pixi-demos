import { Container, Graphics } from 'pixi.js'

import { CLAW_RADIUS } from '#src/constants'
import type { WorldPoint } from '#src/types'
import { Cart } from '#src/ui/box/cart'
import { Rope } from '#src/ui/box/rope'
import { worldToScreen } from '#src/utils/projection'
import { PALETTE } from '@pixi-demos/core/palette'

/**
 * Клешня в сборе: каретка на верхней грани, трос и сама клешня
 */
export class Claw extends Container {
  private readonly cart = new Cart()
  private readonly rope = new Rope()
  private readonly head = new Graphics().circle(0, 0, CLAW_RADIUS).fill({ color: PALETTE.cyan })

  constructor() {
    super()

    this.addChild(this.rope, this.cart, this.head)
  }

  /** Ставит каретку в точку `cart`, клешню — в точку захвата `grip` с отклонением маятника и соединяет их тросом. */
  setPose(cart: WorldPoint, grip: WorldPoint): void {
    const { x, y } = worldToScreen(grip)

    this.cart.setWorld(cart)
    this.rope.setSpan(cart, grip)
    this.head.position.set(x, y)
  }
}
