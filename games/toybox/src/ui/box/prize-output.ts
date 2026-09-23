import { Container, type DestroyOptions, Graphics } from 'pixi.js'

import { LINE_THICKNESS, PRIZE_DOOR_INSET, PRIZE_HATCH_SIZE, PRIZE_SCALE, PRIZE_TAKE_GROWTH } from '#src/constants'
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

/** Окно выдачи на передней грани тумбы: игрушка за сдвижной дверцей, обе ограничены маской окна. */
export class PrizeOutput extends Container {
  private readonly shapes = new ToyShapes()
  private readonly prize = new Toy(this.shapes, 'single', 0, 0xffffff)
  private readonly door = new Graphics()

  constructor() {
    super()

    const hatch = getPrizeHatchOutline()
    const doorSize = PRIZE_HATCH_SIZE - PRIZE_DOOR_INSET * 2
    const mask = new Graphics().poly(hatch).fill(PALETTE.white)
    const content = new Container()
    const border = new Graphics().poly(hatch).stroke({ color: PALETTE.primary, width: LINE_THICKNESS })

    mask.includeInBuild = false
    mask.measurable = false

    // Заливка на всю площадь окна перекрывает игрушку, пока дверца закрыта
    this.door
      .poly(hatch)
      .fill(PALETTE.background)
      .poly(getProjectedPlaneRectangle(CABINET_FRONT_PLANE, doorSize, doorSize))
      .stroke({ color: PALETTE.primary, width: LINE_THICKNESS })

    content.mask = mask
    content.addChild(this.prize, this.door)

    this.addChild(mask, content, border)
  }

  /** Ставит выигранную игрушку за закрытую дверцу. */
  show(appearance: ToyAppearance): void {
    this.prize.setAppearance(appearance.shape, 0, appearance.color)
    this.prize.setPresentationScale(PRIZE_SCALE)
    this.prize.alpha = 1
    this.prize.visible = true
    this.setDoorProgress(0)
  }

  /** Сдвигает дверцу вверх по передней грани: 0 — дверца закрыта, 1 — окно открыто полностью. */
  setDoorProgress(progress: number): void {
    const { x, y } = projectPlaneOffset(CABINET_FRONT_PLANE, 0, -PRIZE_HATCH_SIZE * progress)

    this.door.position.set(x, y)
  }

  /** Растворяет игрушку с небольшим увеличением: 0 — начало получения, 1 — игрушка забрана. */
  setTakeProgress(progress: number): void {
    this.prize.alpha = 1 - progress
    this.prize.setPresentationScale(PRIZE_SCALE + progress * PRIZE_TAKE_GROWTH)
  }

  /** Прячет игрушку и закрывает дверцу. */
  hide(): void {
    this.prize.visible = false
    this.prize.alpha = 1
    this.setDoorProgress(0)
  }

  override destroy(options?: DestroyOptions): void {
    if (this.destroyed) return

    super.destroy(options)
    this.shapes.destroy()
  }
}
