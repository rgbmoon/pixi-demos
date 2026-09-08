import { Container } from 'pixi.js'
import type { StripSlot } from 'src/core/reels/types'

import type { CellView } from './types'

/** Лента одного барабана: view слотов в порядке модели, позиции берутся из неё же. */
export class ReelView<TValue, TView extends CellView<TValue>> extends Container {
  private readonly views: TView[]

  constructor(slotCount: number, createCellView: () => TView) {
    super()

    this.views = Array.from({ length: slotCount }, () => createCellView())

    this.addChild(...this.views)
  }

  getView(slotIndex: number): TView | undefined {
    return this.views[slotIndex]
  }

  /** Переносит состояние слотов в view. Порядок слотов модели стабилен, поэтому view слота не меняется. */
  sync(strip: readonly StripSlot<TValue>[]): void {
    for (let slotIndex = 0; slotIndex < strip.length; slotIndex++) {
      const slot = strip[slotIndex]
      const view = this.views[slotIndex]

      view.y = slot.offset

      view.setValue(slot.value)
      view.setMoving(slot.moving)
    }
  }
}
