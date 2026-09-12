import type { Container, PointData } from 'pixi.js'

/** View ячейки: адаптер двигает его и просит показать значение, арт целиком за игрой. */
export interface CellView<TValue> extends Container {
  setValue(value: TValue): void
  setMoving(moving: boolean): void
}

/** Геометрия ячейки, раскладка лент и фабрика view: всё, что адаптеру нужно знать об арте игры. */
export type ReelsViewConfig<TValue, TView extends CellView<TValue>> = {
  readonly cellWidth: number
  readonly cellHeight: number
  getReelPosition?(index: number): PointData
  createCellView(): TView
}
