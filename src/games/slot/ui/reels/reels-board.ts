import { Container } from 'pixi.js'
import type { CellIndex, ReelsModel } from 'src/core/reels/types'
import type { GameTicker } from 'src/engine/game-ticker'
import { ReelsView } from 'src/engine/reels/reels-view'
import type { SpinePool } from 'src/engine/spine-pool'
import { CELL_HEIGHT, CELL_WIDTH, CELLS_ORIGIN_X, CELLS_ORIGIN_Y } from 'src/games/slot/constants'
import type { SymbolKey } from 'src/games/slot/types'

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
