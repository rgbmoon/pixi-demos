import { Container, Graphics } from 'pixi.js'

import type { ShapeKey, WorldPoint } from '#src/types'
import type { ToyShapes } from '#src/ui/box/toy-shapes'
import { worldToScreen } from '#src/utils/projection'
import { getAngleStep } from '#src/utils/shapes'

/**
 * Игрушка в куче: силуэт формы с цветом через `tint`. Экземпляры используют общие кэшированные
 * контексты геометрии; крен выбирает контекст ближайшего шага угла.
 *
 * Силуэт повторяет коллайдер формы из каталога. Когда форма получит спрайт, коллайдер можно строить по
 * выпуклой оболочке непрозрачных пикселей спрайта: силуэт и физика совпадут без ручной подгонки.
 *
 * Методы не меняют PIXI-объекты при повторе прежних значений.
 */
export class Toy extends Container {
  private readonly shapes: ToyShapes
  private readonly body: Graphics
  private shape: ShapeKey
  private variant: number
  private step = 0
  private highlighted = false

  constructor(shapes: ToyShapes, shape: ShapeKey, variant: number, color: number) {
    super()

    this.shapes = shapes
    this.shape = shape
    this.variant = variant
    this.body = new Graphics(shapes.get(shape, variant, this.step, false))
    this.body.tint = color

    this.addChild(this.body)
  }

  /** Переиспользует экземпляр для другой формы и цвета, без крена. */
  setAppearance(shape: ShapeKey, variant: number, color: number): void {
    this.shape = shape
    this.variant = variant
    this.step = 0
    this.body.tint = color
    this.refresh()
  }

  /** Ставит центр в мировую точку и поворачивает силуэт на крен. */
  setPose(point: WorldPoint, angle: number): void {
    const screen = worldToScreen(point)
    const step = getAngleStep(angle)

    this.position.set(screen.x, screen.y)
    if (step !== this.step) {
      this.step = step
      this.refresh()
    }
  }

  /** Помечает игрушку как цель клешни. */
  setHighlighted(highlighted: boolean): void {
    if (highlighted === this.highlighted) return

    this.highlighted = highlighted
    this.refresh()
  }

  private refresh(): void {
    this.body.context = this.shapes.get(this.shape, this.variant, this.step, this.highlighted)
  }
}
