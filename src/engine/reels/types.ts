import type { Container, PointData } from 'pixi.js'

/** View слота, реализует игра: адаптер задаёт `y` и вызывает `setValue` и `setMoving`. */
export interface CellView<TValue> extends Container {
  setValue(value: TValue): void
  setMoving(moving: boolean): void
}

/** Геометрия ячейки, раскладка барабанов и фабрика view от игры. */
export type ReelsViewConfig<TValue, TView extends CellView<TValue>> = {
  readonly cellWidth: number
  /** Высота ячейки в пикселях: по ней единицы модели переводятся в позиции view. */
  readonly cellHeight: number
  /** Центр верхней ячейки барабана; по умолчанию `(cellWidth * index, 0)`. */
  getReelPosition?(index: number): PointData
  createCellView(): TView
}
