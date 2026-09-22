import { Container, Graphics, Matrix } from 'pixi.js'

import {
  CELL_SIZE,
  LINE_THICKNESS,
  PRIZE_DOOR_INSET,
  PRIZE_HATCH_SIZE,
} from '#src/constants'
import type { ToyAppearance } from '#src/types'
import {
  CABINET_FRONT_PLANE,
  getPrizeHatchOutline,
  getProjectedPlaneRectangle,
  projectPlaneOffset,
} from '#src/utils/machine-geometry'
import { PALETTE } from '@pixi-demos/core/palette'

import { Toy } from './toy'
import { ToyShapes } from './toy-shapes'

/** Контурное окно выдачи с дверцей и одним переиспользуемым объектом игрушки. */
export class PrizeOutput extends Container {
  private readonly shapes = new ToyShapes()
  private readonly prize = new Toy(this.shapes, 'single', 0, 0xffffff)
  private readonly prizePlane = new Container()
  private readonly prizeMask = new Graphics()
  private readonly door = new Graphics()

  constructor() {
    super()

    const hatch = getPrizeHatchOutline()
    const doorSize = PRIZE_HATCH_SIZE - PRIZE_DOOR_INSET * 2
    const mask = new Graphics().poly(hatch).fill(PALETTE.white)
    const border = new Graphics().poly(hatch).stroke({ color: PALETTE.primary, width: LINE_THICKNESS })
    const horizontal = projectPlaneOffset(CABINET_FRONT_PLANE, CELL_SIZE, 0)
    const vertical = projectPlaneOffset(CABINET_FRONT_PLANE, 0, CELL_SIZE)

    this.prizePlane.setFromMatrix(
      new Matrix(
        horizontal.x / CELL_SIZE,
        horizontal.y / CELL_SIZE,
        vertical.x / CELL_SIZE,
        vertical.y / CELL_SIZE
      )
    )
    mask.includeInBuild = false
    mask.measurable = false
    this.prizeMask.includeInBuild = false
    this.prizeMask.measurable = false
    this.prizePlane.addChild(this.prize, this.prizeMask)

    this.door
      .poly(getProjectedPlaneRectangle(CABINET_FRONT_PLANE, doorSize, doorSize))
      .stroke({ color: PALETTE.primary, width: LINE_THICKNESS })

    this.prize.mask = this.prizeMask
    this.door.mask = mask

    this.addChild(mask, this.prizePlane, this.door, border)
  }

  /** Создаёт вид выигранной игрушки до открытия и полностью прячет его маской закрытой дверцы. */
  show(appearance: ToyAppearance): void {
    this.prize.setAppearance(appearance.shape, 0, appearance.color)
    this.prize.setPresentationScale(0.8)
    this.prize.alpha = 1
    this.prize.visible = true
    this.setDoorProgress(0)
  }

  setDoorProgress(progress: number): void {
    const offset = projectPlaneOffset(CABINET_FRONT_PLANE, 0, -PRIZE_HATCH_SIZE * progress)
    const visibleHeight = PRIZE_HATCH_SIZE * progress

    this.door.position.set(offset.x, offset.y)
    this.prizeMask
      .clear()
      .rect(-PRIZE_HATCH_SIZE / 2, PRIZE_HATCH_SIZE / 2 - visibleHeight, PRIZE_HATCH_SIZE, visibleHeight)
      .fill(PALETTE.white)
  }

  setTakeProgress(progress: number): void {
    this.prize.alpha = 1 - progress
    this.prize.setPresentationScale(0.8 + progress * 0.12)
  }

  hide(): void {
    this.prize.visible = false
    this.prize.alpha = 1
    this.setDoorProgress(0)
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.shapes.destroy()
    super.destroy(options)
  }
}
