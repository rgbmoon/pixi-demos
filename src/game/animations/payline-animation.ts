import { Assets, Container, type PointData, Sprite } from 'pixi.js'

import { WIN_LINE_SRC } from '../assets'
import { PAYLINE_JOINT_OVERLAP, PAYLINE_THICKNESS, PAYLINES } from '../constants'
import type { PaylineShape } from '../types'
import { getPaylinePoints } from '../utils'

export class PaylineAnimation {
  readonly view = new Container()

  constructor(lineId: string) {
    this.view.visible = false

    const shape: PaylineShape | undefined = PAYLINES[lineId]

    if (!shape) return

    const points = getPaylinePoints(shape)

    // Спрайт рисует отрезок между соседними вершинами: 7 точек ломаной дают 6 отрезков.
    // Номер отрезка и их общее число нужны createSegment, чтобы отличить крайние концы от стыков
    for (let index = 0; index < points.length - 1; index++) {
      this.view.addChild(this.createSegment(points[index], points[index + 1], index, points.length - 1))
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
    this.view.visible = true
  }

  hide(): void {
    this.view.visible = false
  }
}
