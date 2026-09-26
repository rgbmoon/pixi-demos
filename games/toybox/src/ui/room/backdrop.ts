import { Container, Graphics } from 'pixi.js'

import { BACKGROUND_COLOR } from '#src/constants'
import type { ScreenRect } from '#src/types'

/** Фон зала за автоматом: заливка всего канваса. */
export class Backdrop extends Container {
  private readonly fill = new Graphics()

  constructor() {
    super()

    this.addChild(this.fill)
  }

  /** Заливает прямоугольник `area` в своих координатах; пустой прямоугольник не рисуется. */
  cover({ left, top, right, bottom }: ScreenRect): void {
    this.fill.clear()

    if (right <= left || bottom <= top) return

    this.fill.rect(left, top, right - left, bottom - top).fill({ color: BACKGROUND_COLOR })
  }
}
