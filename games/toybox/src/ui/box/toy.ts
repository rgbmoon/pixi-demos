import { Container, Graphics, GraphicsContext } from 'pixi.js'

import { TOY_FILL_ALPHA, TOY_HIGHLIGHT_THICKNESS, TOY_RADIUS, TOY_THICKNESS } from '#src/constants'
import type { WorldPoint } from '#src/types'
import { getDepthOrder, getDepthScale, worldToScreen } from '#src/utils'
import { PALETTE } from '@pixi-demos/core/palette'

/** Общая геометрия игрушек: обычная и подсвеченная. Владелец создаёт пару и уничтожает с собой. */
export type ToyContexts = {
  plain: GraphicsContext
  highlighted: GraphicsContext
}

/**
 * Игрушка в куче: кружок с бордером и полупрозрачной заливкой. Геометрия приходит общими
 * контекстами — в куче их сотни; цвет задаётся tint поверх белой заливки.
 */
export class Toy extends Container {
  /** Собирает пару общих контекстов: у подсвеченной игрушки толще бордер. */
  static createContexts(): ToyContexts {
    const build = (thickness: number) =>
      new GraphicsContext()
        .circle(0, 0, TOY_RADIUS)
        .fill({ color: PALETTE.white, alpha: TOY_FILL_ALPHA })
        .stroke({ width: thickness, color: PALETTE.white })

    return { plain: build(TOY_THICKNESS), highlighted: build(TOY_HIGHLIGHT_THICKNESS) }
  }

  private readonly contexts: ToyContexts
  private readonly body: Graphics
  private point: WorldPoint = { x: 0, y: 0, z: 0 }
  private bounce = 0

  constructor(contexts: ToyContexts, color: number) {
    super()

    this.contexts = contexts
    this.body = new Graphics(contexts.plain)
    this.body.tint = color

    this.addChild(this.body)
  }

  /** Точка мира, в которой игрушка стоит сейчас. */
  getWorld(): WorldPoint {
    return this.point
  }

  /** Ставит игрушку в точку мира; с глубиной она мельче. Порядок наложения обновляется вместе с ней. */
  setWorld(point: WorldPoint): void {
    this.point = point

    this.place()
  }

  /**
   * Смещение по высоте поверх точки мира: прожатие под весом клешни и отскок при посадке.
   * Порядок наложения на него не отзывается — иначе сортировка дёргалась бы на каждом отскоке.
   */
  setBounce(offset: number): void {
    this.bounce = offset

    this.place()
  }

  /** Помечает игрушку как цель клешни. */
  setHighlighted(highlighted: boolean): void {
    this.body.context = highlighted ? this.contexts.highlighted : this.contexts.plain
  }

  private place(): void {
    const screen = worldToScreen({ ...this.point, z: this.point.z + this.bounce })

    this.position.set(screen.x, screen.y)
    this.scale.set(getDepthScale(this.point.x))
    this.zIndex = getDepthOrder(this.point)
  }
}
