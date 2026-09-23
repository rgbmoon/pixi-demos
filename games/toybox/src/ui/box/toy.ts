import { Container, Graphics } from 'pixi.js'

import type { Facing, ShapeKey, WorldPoint } from '#src/types'
import type { ToyShapes } from '#src/ui/box/toy-shapes'
import { getDepthOrder, worldToScreen } from '#src/utils/projection'

import { getShapeDepthOffset } from './utils'

/**
 * Игрушка в куче: силуэт формы с цветом через `tint`. Экземпляры используют общие кэшированные
 * контексты геометрии.
 *
 * Методы не меняют PIXI-объекты при повторе прежних значений. Запись `zIndex` иначе запускала бы
 * сортировку слоя каждый кадр.
 */
export class Toy extends Container {
  private readonly shapes: ToyShapes
  private readonly body: Graphics
  private shape: ShapeKey
  private facing: Facing
  private highlighted = false
  private depthOffset = 0
  private depth = Number.NaN

  constructor(shapes: ToyShapes, shape: ShapeKey, facing: Facing, color: number) {
    super()

    this.shapes = shapes
    this.shape = shape
    this.facing = facing
    this.body = new Graphics(shapes.get(shape, facing, false))
    this.body.tint = color

    this.addChild(this.body)
    this.updateDepthOffset()
  }

  /** Переиспользует экземпляр для другой формы и цвета. */
  setAppearance(shape: ShapeKey, facing: Facing, color: number): void {
    this.shape = shape
    this.facing = facing
    this.body.tint = color
    this.refresh()
    this.updateDepthOffset()
  }

  /** Масштаб отдельной презентации в окне выдачи. */
  setPresentationScale(scale: number): void {
    this.scale.set(scale)
  }

  /** Ставит центр в мировую точку и сортирует по ближайшей клетке текущего силуэта. */
  setWorld(point: WorldPoint, bounce: number): void {
    const visible = { x: point.x, y: point.y, z: point.z + bounce }
    const screen = worldToScreen(visible)
    const depth = getDepthOrder(visible) + this.depthOffset

    this.position.set(screen.x, screen.y)
    if (depth !== this.depth) {
      this.depth = depth
      this.zIndex = depth
    }
  }

  /** Меняет ориентацию силуэта при посадке. */
  setFacing(facing: Facing): void {
    if (facing === this.facing) return

    this.facing = facing
    this.refresh()
    this.updateDepthOffset()
  }

  /** Помечает игрушку как цель клешни. */
  setHighlighted(highlighted: boolean): void {
    if (highlighted === this.highlighted) return

    this.highlighted = highlighted
    this.refresh()
  }

  private refresh(): void {
    this.body.context = this.shapes.get(this.shape, this.facing, this.highlighted)
  }

  private updateDepthOffset(): void {
    this.depthOffset = getShapeDepthOffset(this.shape, this.facing)
  }
}
