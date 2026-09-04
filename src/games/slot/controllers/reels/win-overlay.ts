import type { GameTicker } from 'src/engine/game-ticker'
import { LiveContainer } from 'src/engine/live-container'
import type { Payline } from 'src/games/slot/api/slot'
import { PAYLINE_VISIBLE_MS, WIN_FRAMES_VISIBLE_MS, WIN_SHOWCASE_MS } from 'src/games/slot/constants'
import type { SlotStore } from 'src/games/slot/stores/slot'
import type { WinCell } from 'src/games/slot/types'
import type { ReelSymbol } from 'src/games/slot/ui/reels/reel-symbol'
import { WinOverlay } from 'src/games/slot/ui/reels/win-overlay'

import type { PaylinesController } from './paylines'

/**
 * Разбор выигрыша: держит набор линий раунда и ведёт показ по стадиям —
 * сперва все линии разом, затем по одной с рамками.
 */
export class WinOverlayController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly paylinesController: PaylinesController
  private readonly overlay = new WinOverlay()
  private paylines: SlotStore['spinPaylines'] = []

  constructor(ticker: GameTicker, slotStore: SlotStore, paylinesController: PaylinesController) {
    super()

    this.ticker = ticker
    this.paylinesController = paylinesController

    this.addChild(this.overlay)

    this.watch(
      () => slotStore.spinPaylines,
      (spinPaylines) => {
        this.paylines = spinPaylines
      },
      {
        fireImmediately: true,
      }
    )
  }

  /** Символы линии сверху вниз: барабан без выигрыша приходит с `null` вместо ряда. */
  private getPaylineSymbols(payline: Payline, grid: ReelSymbol[][]): ReelSymbol[] {
    return payline.line.flatMap((row, reel) => (row === null ? [] : [grid[reel][row]]))
  }

  /** Ячейки линии для рамок: барабан без выигрыша пропускается. */
  private getPaylineCells(payline: Payline): WinCell[] {
    return payline.line.flatMap((row, reel) => (row === null ? [] : [{ reel, row }]))
  }

  /** Снимает показ целиком, вызывается в конце каждой стадии и при отмене. */
  private reset(): void {
    this.paylinesController.hide()
    this.overlay.clear()
  }

  /** Показывает разом все выигравшие линии и их символы, затем гасит показ. */
  async showAllWins(symbolContainers: ReelSymbol[][], signal?: AbortSignal): Promise<void> {
    const cells = new Set(this.paylines.flatMap((payline) => this.getPaylineSymbols(payline, symbolContainers)))

    try {
      this.overlay.raiseSymbols(Array.from(cells))
      this.paylinesController.show(this.paylines.map((payline) => payline.lineId))

      await this.ticker.waitTicks(WIN_SHOWCASE_MS, signal)
    } finally {
      this.reset()
    }
  }

  /** Разбирает выигрыш по линиям: линия с символом, затем рамки с той же анимацией символа. */
  async playWinLines(symbolContainers: ReelSymbol[][], signal?: AbortSignal): Promise<void> {
    try {
      for (const payline of this.paylines) {
        this.overlay.raiseSymbols(this.getPaylineSymbols(payline, symbolContainers))
        this.paylinesController.show([payline.lineId])

        await this.ticker.waitTicks(PAYLINE_VISIBLE_MS, signal)

        this.paylinesController.hide()
        this.overlay.showFrames(this.getPaylineCells(payline))

        await this.ticker.waitTicks(WIN_FRAMES_VISIBLE_MS, signal)

        this.reset()
      }
    } finally {
      this.reset()
    }
  }
}
