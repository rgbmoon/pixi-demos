import { GraphicsContext } from 'pixi.js'

import { LINE_THICKNESS, TOY_FILL_ALPHA, TOY_HIGHLIGHT_THICKNESS } from '#src/constants'
import type { ShapeKey } from '#src/types'
import { getShapeOutline } from '#src/utils/shapes'
import { PALETTE } from '@pixi-demos/core/palette'

/**
 * Общая геометрия игрушек
 * Хранит контексты контексты графики
 */
export class ToyShapes {
  private readonly contexts = new Map<string, GraphicsContext>()

  /** Силуэт формы в её положении и на шаге крена, обычный или подсвеченный. */
  get(shape: ShapeKey, variant: number, step: number, highlighted: boolean): GraphicsContext {
    const key = `${shape}:${variant}:${step}:${highlighted ? 'on' : 'off'}`
    const known = this.contexts.get(key)

    if (known) return known

    const context = ToyShapes.build(shape, variant, step, highlighted)

    this.contexts.set(key, context)

    return context
  }

  /** Уничтожает все созданные контексты. */
  destroy(): void {
    for (const context of this.contexts.values()) {
      context.destroy()
    }

    this.contexts.clear()
  }

  /** Одна замкнутая фигура на всю игрушку: проекция призмы тела. */
  private static build(shape: ShapeKey, variant: number, step: number, highlighted: boolean): GraphicsContext {
    return new GraphicsContext()
      .poly(getShapeOutline(shape, variant, step))
      .fill({ color: PALETTE.white, alpha: TOY_FILL_ALPHA })
      .stroke({ width: highlighted ? TOY_HIGHLIGHT_THICKNESS : LINE_THICKNESS, color: PALETTE.white })
  }
}
