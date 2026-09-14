import { Container } from 'pixi.js'

import { CELL_HEIGHT, CELL_WIDTH, CELLS_ORIGIN_X, CELLS_ORIGIN_Y } from '#src/constants'
import type { SymbolKey } from '#src/types'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import type { SpinePool } from '@pixi-demos/engine/spine-pool'
import type { CellIndex, ReelsModel } from '@pixi-demos/reels'
import { ReelsView } from '@pixi-demos/reels-pixi-adapter'

import { ReelSymbol } from './reel-symbol'
import { ReelsFrame } from './reels-frame'

/** Доска барабанов: рамка, барабаны `ReelsView` в зоне символов и слои оверлеев поверх неё. */
export class ReelsBoard extends Container {
  private readonly frame: ReelsFrame
  private readonly reelsView: ReelsView<SymbolKey, ReelSymbol>

  constructor(ticker: GameTicker, model: ReelsModel<SymbolKey>, pool: SpinePool) {
    super()

    this.reelsView = new ReelsView(ticker, model, {
      cellWidth: CELL_WIDTH,
      cellHeight: CELL_HEIGHT,
      createCellView: () => new ReelSymbol(pool),
    })

    this.reelsView.position.set(CELLS_ORIGIN_X, CELLS_ORIGIN_Y)

    this.frame = new ReelsFrame(ticker)
    this.frame.addChildToSymbolsSlot(this.reelsView)

    this.addChild(this.frame)
  }

  /** Добавляет слой поверх символов; слои ложатся в порядке вызовов. */
  addOverlay(overlay: Container): void {
    overlay.position.set(CELLS_ORIGIN_X, CELLS_ORIGIN_Y)

    this.frame.addChildToSymbolsWinSlot(overlay)
  }

  /** View символа, стоящего в ячейке сейчас. */
  getCellView(index: CellIndex): ReelSymbol | undefined {
    return this.reelsView.getCellView(index)
  }

  showTint(signal?: AbortSignal): Promise<void> {
    return this.frame.showTint(signal)
  }

  hideTint(signal?: AbortSignal): Promise<void> {
    return this.frame.hideTint(signal)
  }
}
