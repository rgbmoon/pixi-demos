import { Container, Graphics } from 'pixi.js'

import type { Facing, ShapeKey, WorldPoint } from '#src/types'
import type { ToyShapes } from '#src/ui/box/toy-shapes'
import { getDepthScale, worldToScreen } from '#src/utils/projection'

/** Доля доворота, на которой силуэт сменяется с прежнего на новый. */
const TURN_MIDPOINT = 0.5

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
  private depthScale = 1
  private turnWidth = 1
  private depth = Number.NaN

  constructor(shapes: ToyShapes, shape: ShapeKey, facing: Facing, color: number) {
    super()

    this.shapes = shapes
    this.shape = shape
    this.facing = facing
    this.body = new Graphics(shapes.get(shape, facing, false))
    this.body.tint = color

    this.addChild(this.body)
  }

  /** Переиспользует экземпляр для другой формы и цвета. */
  setAppearance(shape: ShapeKey, facing: Facing, color: number): void {
    this.shape = shape
    this.facing = facing
    this.body.tint = color
    this.refresh()
  }

  /** Ставит отдельный масштаб для презентации вне координат мира. */
  setPresentationScale(scale: number): void {
    this.depthScale = scale
    this.turnWidth = 1
    this.applyScale()
  }

  /** Ограничивает игрушку геометрией стеклянного бокса или снимает ограничение. */
  setClippingMask(mask: Container | null): void {
    this.mask = mask
  }

  /** Ставит середину игрушки в точку мира, приподнятую отскоком; с глубиной она мельче. */
  setWorld(point: WorldPoint, bounce: number): void {
    const screen = worldToScreen({ x: point.x, y: point.y, z: point.z + bounce })

    this.position.set(screen.x, screen.y)
    this.depthScale = getDepthScale(point.x)
    this.applyScale()
  }

  /**
   * Ключ наложения. Отскок на него не влияет — иначе слой пересортировывался бы на каждом
   * колебании пружины.
   */
  setDepth(depth: number): void {
    if (depth === this.depth) return

    this.depth = depth
    this.zIndex = depth
  }

  /**
   * Доворот на четверть оборота: `turn` — его доля, единица означает, что доворота нет.
   * Ширина ведётся `|cos(turn · π)|` и потому равна единице и в начале, и в конце; силуэт сменяется
   * на середине, когда ширина проходит через ноль. Получается переворот, а не вращение — в изометрии
   * четверть оборота меняет силуэт, и повернуть картинку было бы неверно.
   */
  setTurn(facing: Facing, turn: number): void {
    if (turn >= TURN_MIDPOINT && facing !== this.facing) {
      this.facing = facing
      this.refresh()
    }

    this.turnWidth = Math.abs(Math.cos(turn * Math.PI))
    this.applyScale()
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

  private applyScale(): void {
    this.scale.set(this.depthScale * this.turnWidth, this.depthScale)
  }
}
