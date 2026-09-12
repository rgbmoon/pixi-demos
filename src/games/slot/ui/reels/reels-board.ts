import { Container } from 'pixi.js'
import type { ReelsMachine } from 'src/core/reels/reels-machine'
import type { GameTicker } from 'src/engine/game-ticker'
import { ReelsView } from 'src/engine/reels/reels-view'
import type { SpinePool } from 'src/engine/spine-pool'
import { CELL_HEIGHT, CELL_WIDTH, CELLS_ORIGIN_X, CELLS_ORIGIN_Y } from 'src/games/slot/constants'
import type { SlotReelsData } from 'src/games/slot/reels'
import type { SymbolKey } from 'src/games/slot/types'

import { ReelSymbol } from './reel-symbol'
import { ReelsFrame } from './reels-frame'

/**
 * Поле барабанов: арт рамки и view лент над моделью машины.
 * Саму прокрутку ведёт модель, поле отвечает за арт, зону символов и слои поверх неё.
 */
export class ReelsBoard extends Container {
  private readonly frame: ReelsFrame
  private readonly reelsView: ReelsView<SlotReelsData, SymbolKey, ReelSymbol>

  constructor(ticker: GameTicker, machine: ReelsMachine<SlotReelsData, SymbolKey>, pool: SpinePool) {
    super()

    this.reelsView = new ReelsView(ticker, machine, {
      cellWidth: CELL_WIDTH,
      cellHeight: CELL_HEIGHT,
      createCellView: () => new ReelSymbol(pool),
    })

    this.reelsView.position.set(CELLS_ORIGIN_X, CELLS_ORIGIN_Y)

    this.frame = new ReelsFrame(ticker)
    this.frame.addChildToSymbolsSlot(this.reelsView)

    this.addChild(this.frame)
  }

  /** Кладёт слой поверх символов: разбор выигрыша и линии приходят снаружи, порядок вызовов — их порядок. */
  addOverlay(overlay: Container): void {
    overlay.position.set(CELLS_ORIGIN_X, CELLS_ORIGIN_Y)

    this.frame.addChildToSymbolsWinSlot(overlay)
  }

  /** View видимых символов по барабанам — сетка, по которой владелец ищет выигравшие ячейки. */
  getGridViews(): ReelSymbol[][] {
    return this.reelsView.getGridViews()
  }

  showTint(signal?: AbortSignal): Promise<void> {
    return this.frame.showTint(signal)
  }

  hideTint(signal?: AbortSignal): Promise<void> {
    return this.frame.hideTint(signal)
  }
}
