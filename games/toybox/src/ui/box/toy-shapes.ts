import { GraphicsContext } from 'pixi.js'

import { TOY_FILL_ALPHA, TOY_HIGHLIGHT_THICKNESS, TOY_THICKNESS } from '#src/constants'
import type { Facing, ShapeKey } from '#src/types'
import { getShapeOutline } from '#src/utils/heap'
import { PALETTE } from '@pixi-demos/core/palette'

/**
 * Общая геометрия игрушек: по контексту на форму, её ориентацию и состояние подсветки.
 * Контекст создаётся при первом обращении и кэшируется до уничтожения владельца.
 */
export class ToyShapes {
  private readonly contexts = new Map<string, GraphicsContext>()

  /** Силуэт формы в её ориентации, обычный или подсвеченный. */
  get(shape: ShapeKey, facing: Facing, highlighted: boolean): GraphicsContext {
    const key = `${shape}:${facing}:${highlighted ? 'on' : 'off'}`
    const known = this.contexts.get(key)

    if (known) return known

    const context = ToyShapes.build(shape, facing, highlighted)

    this.contexts.set(key, context)

    return context
  }

  destroy(): void {
    for (const context of this.contexts.values()) {
      context.destroy()
    }

    this.contexts.clear()
  }

  /** Одна замкнутая фигура на всю игрушку: у составной формы контур не распадается на кружки. */
  private static build(shape: ShapeKey, facing: Facing, highlighted: boolean): GraphicsContext {
    return new GraphicsContext()
      .poly(getShapeOutline(shape, facing))
      .fill({ color: PALETTE.white, alpha: TOY_FILL_ALPHA })
      .stroke({ width: highlighted ? TOY_HIGHLIGHT_THICKNESS : TOY_THICKNESS, color: PALETTE.white })
  }
}
