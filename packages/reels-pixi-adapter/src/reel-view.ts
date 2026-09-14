import { Container } from 'pixi.js'

import type { StripSlot } from '@pixi-demos/reels'

import type { CellView } from './types'

/** View слотов одного барабана в порядке `getStrip()`. */
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

  /**
   * Записывает в view позицию, значение и позу слотов; `scale` переводит единицы модели в пиксели.
   * View, перенесённый в другой контейнер, пропускает, пока тот не вернёт его в барабан.
   */
  sync(strip: readonly Readonly<StripSlot<TValue>>[], scale: number): void {
    for (let slotIndex = 0; slotIndex < strip.length; slotIndex++) {
      const slot = strip[slotIndex]
      const view = this.views[slotIndex]

      if (view.parent !== this) continue

      view.y = slot.offset * scale

      view.setValue(slot.value)
      view.setMoving(slot.moving)
    }
  }
}
