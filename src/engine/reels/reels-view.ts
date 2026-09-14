import { Container, type DestroyOptions, Graphics, type Ticker } from 'pixi.js'
import type { CellIndex, ReelsModel } from 'src/core/reels/types'

import { ReelView } from './reel-view'
import type { CellView, ReelsViewConfig } from './types'

/**
 * PIXI-адаптер модели барабанов: раскладывает барабаны и накрывает их масками; на каждом кадре тикера
 * вызывает `advance` модели и переносит слоты в view.
 */
export class ReelsView<TValue, TView extends CellView<TValue>> extends Container {
  private readonly ticker: Ticker
  private readonly model: ReelsModel<TValue>
  private readonly reelViews: ReelView<TValue, TView>[]
  /** Пикселей view на единицу длины модели. */
  private readonly unitScale: number
  /** Ревизия каждого барабана на момент последней отрисовки: с ней сверяется `sync`. */
  private readonly drawnRevisions: number[]

  constructor(ticker: Ticker, model: ReelsModel<TValue>, config: ReelsViewConfig<TValue, TView>) {
    super()

    this.ticker = ticker
    this.model = model
    this.unitScale = config.cellHeight / model.cellHeight
    this.reelViews = model.getReels().map((reel) => new ReelView(reel.getStrip().length, config.createCellView))
    this.drawnRevisions = this.reelViews.map(() => -1)

    this.layoutLanes(config)
    this.sync()

    this.ticker.add(this.step)
  }

  override destroy(options?: DestroyOptions): void {
    this.ticker.remove(this.step)

    super.destroy(options)
  }

  /** View, занимающий ячейку поля сейчас. */
  getCellView(index: CellIndex): TView | undefined {
    const slotIndex = this.model.getReels()[index.reel]?.getVisibleSlotIndices()[index.row]

    return slotIndex === undefined ? undefined : this.reelViews[index.reel].getView(slotIndex)
  }

  /**
   * Расставляет барабаны по раскладке и накрывает масками. Барабаны с одним `y` делят маску-полосу:
   * число stencil-масок равно числу рядов раскладки, буферные слоты лежат над полосой.
   */
  private layoutLanes(config: ReelsViewConfig<TValue, TView>): void {
    const { cellWidth, cellHeight, getReelPosition } = config
    const reels = this.model.getReels()
    const lanes = new Map<number, number[]>()

    this.reelViews.forEach((reelView, index) => {
      const { x, y } = getReelPosition?.(index) ?? { x: cellWidth * index, y: 0 }

      reelView.position.set(x, y)
      lanes.set(y, [...(lanes.get(y) ?? []), index])
    })

    lanes.forEach((indices, y) => {
      const xs = indices.map((index) => this.reelViews[index].x)
      const rows = Math.max(...indices.map((index) => reels[index].rows))
      const left = Math.min(...xs) - cellWidth / 2
      const lane = new Container()
      const mask = new Graphics()
        .rect(left, y - cellHeight / 2, Math.max(...xs) + cellWidth / 2 - left, rows * cellHeight)
        .fill(0xffffff)

      lane.mask = mask
      lane.addChild(mask, ...indices.map((index) => this.reelViews[index]))

      this.addChild(lane)
    })
  }

  private step = (ticker: Ticker): void => {
    this.model.advance(ticker.deltaTime)

    this.sync()
  }

  /**
   * Переносит в view только барабаны с выросшей ревизией, поэтому view стоящего барабана можно временно
   * перенести в другой контейнер.
   */
  private sync(): void {
    const reels = this.model.getReels()

    for (let index = 0; index < reels.length; index++) {
      const revision = reels[index].getRevision()

      if (revision === this.drawnRevisions[index]) continue

      this.drawnRevisions[index] = revision

      this.reelViews[index].sync(reels[index].getStrip(), this.unitScale)
    }
  }
}
