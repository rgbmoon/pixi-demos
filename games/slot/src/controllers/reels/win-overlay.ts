import type { Payline } from '#src/api/slot'
import { PAYLINE_VISIBLE_MS, WIN_FRAMES_VISIBLE_MS, WIN_SHOWCASE_MS } from '#src/constants'
import type { SlotStore } from '#src/stores/slot'
import type { ReelSymbol } from '#src/ui/reels/reel-symbol'
import { WinOverlay } from '#src/ui/reels/win-overlay'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'
import type { CellIndex } from '@pixi-demos/reels'

import type { PaylinesController } from './paylines'

/** Разбор выигрыша по стадиям: сперва все линии шага разом, затем по одной с рамками. */
export class WinOverlayController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly slotStore: SlotStore
  private readonly paylinesController: PaylinesController
  private readonly getSymbol: (cell: CellIndex) => ReelSymbol | undefined
  private readonly overlay = new WinOverlay()

  constructor(
    ticker: GameTicker,
    slotStore: SlotStore,
    paylinesController: PaylinesController,
    getSymbol: (cell: CellIndex) => ReelSymbol | undefined
  ) {
    super()

    this.ticker = ticker
    this.slotStore = slotStore
    this.paylinesController = paylinesController
    this.getSymbol = getSymbol

    this.addChild(this.overlay)
  }

  /** Ячейки линии: барабан без выигрыша приходит с `null` вместо ряда и пропускается. */
  private getPaylineCells(payline: Payline): CellIndex[] {
    return payline.line.flatMap((row, reel) => (row === null ? [] : [{ reel, row }]))
  }

  /** Символы, стоящие в ячейках линии. */
  private getPaylineSymbols(payline: Payline): ReelSymbol[] {
    return this.getPaylineCells(payline).flatMap((cell) => this.getSymbol(cell) ?? [])
  }

  /** Снимает показ целиком, вызывается в конце каждой стадии и при отмене. */
  private reset(): void {
    this.paylinesController.hide()
    this.overlay.clear()
  }

  /** Показывает разом все выигравшие линии и их символы на `durationMs`, затем гасит показ. */
  async showAllWins(signal?: AbortSignal, durationMs: number = WIN_SHOWCASE_MS): Promise<void> {
    const paylines = this.slotStore.stepPaylines
    const symbols = new Set(paylines.flatMap((payline) => this.getPaylineSymbols(payline)))

    try {
      this.overlay.raiseSymbols(Array.from(symbols))
      this.paylinesController.show(paylines.map((payline) => payline.lineId))

      await this.ticker.waitTicks(durationMs, signal)
    } finally {
      this.reset()
    }
  }

  /** Разбирает выигрыш по линиям: линия с символом, затем рамки с той же анимацией символа. */
  async playWinLines(signal?: AbortSignal): Promise<void> {
    try {
      for (const payline of this.slotStore.stepPaylines) {
        this.overlay.raiseSymbols(this.getPaylineSymbols(payline))
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
