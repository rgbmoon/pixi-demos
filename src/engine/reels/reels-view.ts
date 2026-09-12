import { Container, type DestroyOptions, Graphics, type Ticker } from 'pixi.js'
import type { ReelsMachine } from 'src/core/reels/reels-machine'
import type { CellIndex } from 'src/core/reels/types'
import type { GameTicker } from 'src/engine/game-ticker'

import { ReelView } from './reel-view'
import type { CellView, ReelsViewConfig } from './types'

/**
 * Адаптер модели барабанов к PIXI: раскладка лент, маски и управление временем модели.
 * Ничего не решает — на каждом кадре двигает модель и переносит её слоты в view.
 */
export class ReelsView<TData, TValue, TView extends CellView<TValue>> extends Container {
  private readonly ticker: GameTicker
  private readonly machine: ReelsMachine<TData, TValue>
  private readonly reelViews: ReelView<TValue, TView>[]
  /** Ревизия каждого барабана на момент последней отрисовки: с ней сверяется `sync`. */
  private readonly drawnRevisions: number[]

  constructor(ticker: GameTicker, machine: ReelsMachine<TData, TValue>, config: ReelsViewConfig<TValue, TView>) {
    super()

    const { cellWidth, cellHeight, createCellView } = config

    this.ticker = ticker
    this.machine = machine
    this.reelViews = machine.getReels().map((reel) => new ReelView(reel.getStrip().length, createCellView))
    this.drawnRevisions = this.reelViews.map(() => -1)

    // Ленты с одним y делят маску-полосу: буферные слоты полосы лежат над ней, а число stencil-масок
    // равно числу рядов раскладки
    const lanes = new Map<number, number[]>()

    this.reelViews.forEach((reelView, index) => {
      const { x, y } = config.getReelPosition?.(index) ?? { x: cellWidth * index, y: 0 }

      reelView.position.set(x, y)
      lanes.set(y, [...(lanes.get(y) ?? []), index])
    })

    lanes.forEach((indices, y) => {
      const xs = indices.map((index) => this.reelViews[index].x)
      const rows = Math.max(...indices.map((index) => machine.getReels()[index].getCells().length))
      const left = Math.min(...xs) - cellWidth / 2
      const lane = new Container()
      const mask = new Graphics()
        .rect(left, y - cellHeight / 2, Math.max(...xs) + cellWidth / 2 - left, rows * cellHeight)
        .fill(0xffffff)

      lane.mask = mask
      lane.addChild(mask, ...indices.map((index) => this.reelViews[index]))

      this.addChild(lane)
    })

    this.sync()

    this.ticker.add(this.step)
  }

  override destroy(options?: DestroyOptions): void {
    this.ticker.remove(this.step)

    super.destroy(options)
  }

  /** View, занимающий ячейку поля сейчас. */
  getCellView(index: CellIndex): TView | undefined {
    const reel = this.machine.getReel(index.reel)

    if (!reel) return undefined

    const slotIndex = reel.getVisibleSlotIndices()[index.row]

    return slotIndex === undefined ? undefined : this.reelViews[index.reel].getView(slotIndex)
  }

  /** View видимых ячеек по барабанам: сетка `[барабан][ряд]`, по ней владелец ищет выигравшие ячейки. */
  getGridViews(): TView[][] {
    return this.machine.getReels().map((reel, index) =>
      reel.getVisibleSlotIndices().flatMap((slotIndex) => {
        const view = this.reelViews[index].getView(slotIndex)

        return view ? [view] : []
      })
    )
  }

  private step = (ticker: Ticker): void => {
    this.machine.advance(ticker.deltaTime)

    this.sync()
  }

  /**
   * Переносит в view только те барабаны, чья модель изменилась с прошлого кадра.
   * Неподвижный барабан пропускается намеренно: пока он стоит, его view забирает себе
   * оверлей выигрыша — поднимает их поверх затемнения. Запись позиций в это время
   * перебила бы положение, выставленное оверлеем.
   */
  private sync(): void {
    const reels = this.machine.getReels()

    for (let index = 0; index < reels.length; index++) {
      const revision = reels[index].getRevision()

      if (revision === this.drawnRevisions[index]) continue

      this.drawnRevisions[index] = revision

      this.reelViews[index].sync(reels[index].getStrip())
    }
  }
}
