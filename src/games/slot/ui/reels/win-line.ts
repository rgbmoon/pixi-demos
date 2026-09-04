import { Assets, Container, type PointData, Sprite } from 'pixi.js'
import { WIN_LINE_SRC } from 'src/games/slot/assets'
import { PAYLINE_JOINT_OVERLAP, PAYLINE_THICKNESS, PAYLINES } from 'src/games/slot/constants'
import type { PaylineShape } from 'src/games/slot/types'
import { getPaylinePoints } from 'src/games/slot/utils'

/** Линия выплат: ломаная из спрайтов по геометрии линии; показывается и гасится целиком. */
export class WinLine extends Container {
  constructor(lineId: string) {
    super()

    this.visible = false

    const shape: PaylineShape | undefined = PAYLINES[lineId]

    if (!shape) return

    const points = getPaylinePoints(shape)

    // Спрайт рисует отрезок между соседними вершинами: 7 точек ломаной дают 6 отрезков.
    // Номер отрезка и их общее число нужны createSegment, чтобы отличить крайние концы от стыков
    for (let index = 0; index < points.length - 1; index++) {
      this.addChild(this.createSegment(points[index], points[index + 1], index, points.length - 1))
    }
  }

  /** Отрезок ломаной: спрайт растянут по длине и повёрнут вдоль неё, на изломах продлён на нахлёст. */
  private createSegment(from: PointData, to: PointData, index: number, segmentsCount: number): Sprite {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.hypot(dx, dy)
    // Крайние концы упираются в рамку заподлицо, поэтому продлеваются только стыки с соседями
    const startOverlap = index > 0 ? PAYLINE_JOINT_OVERLAP : 0
    const endOverlap = index < segmentsCount - 1 ? PAYLINE_JOINT_OVERLAP : 0

    const segment = new Sprite(Assets.get(WIN_LINE_SRC))

    segment.anchor.set(0, 0.5)
    segment.position.set(from.x - (dx / length) * startOverlap, from.y - (dy / length) * startOverlap)
    segment.rotation = Math.atan2(dy, dx)
    segment.width = length + startOverlap + endOverlap
    segment.height = PAYLINE_THICKNESS

    return segment
  }

  show(): void {
    this.visible = true
  }

  hide(): void {
    this.visible = false
  }
}
