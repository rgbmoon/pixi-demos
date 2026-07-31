import type { Container } from 'pixi.js'
import type { Payline } from 'src/api/root-api'
import {
  CELL_HEIGHT,
  CELL_WIDTH,
  PAYLINE_VISIBLE_MS,
  REELS_COUNT,
  WIN_FRAMES_VISIBLE_MS,
  WIN_SHOWCASE_MS,
} from 'src/game/constants'
import type { GameTicker } from 'src/game/game-ticker'
import type { SpinePool } from 'src/game/spine-pool'
import { LiveContainer } from 'src/game/ui/live-container'
import type { SceneStore } from 'src/stores/scene-store'

import type { SymbolAnimation } from '../animations/symbol-animation'
import { WinFrameAnimation } from '../animations/win-frame-animation'

export class ReelsWinOverlayController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly reparentedSymbols = new Map<SymbolAnimation, Container>()
  private readonly winFrames: WinFrameAnimation[]
  private paylines: SceneStore['spinPaylines'] = []

  constructor(ticker: GameTicker, pool: SpinePool, sceneStore: SceneStore) {
    super()

    this.ticker = ticker

    this.winFrames = Array.from({ length: REELS_COUNT }, () => new WinFrameAnimation(pool))
    this.addChild(...this.winFrames.map((winFrame) => winFrame.view))

    this.watch(
      () => sceneStore.spinPaylines,
      (spinPaylines) => {
        this.paylines = spinPaylines
      },
      {
        fireImmediately: true,
      }
    )
  }

  /** Символы линии сверху вниз: барабан без выигрыша приходит с `null` вместо ряда. */
  private getPaylineSymbols(payline: Payline, grid: SymbolAnimation[][]): SymbolAnimation[] {
    return payline.line.flatMap((row, reel) => (row === null ? [] : [grid[reel][row]]))
  }

  /** Поднимает символы в оверлей и активирует у них выигрышную анимацию. */
  private showWinSymbols(symbols: SymbolAnimation[]): void {
    symbols.forEach((symbol) => {
      const { parent } = symbol.view

      if (!parent) return

      this.reparentedSymbols.set(symbol, parent)
      this.reparentChild(symbol.view)

      symbol.win()
    })
  }

  /** Глушит выигрышную анимацию и возвращает символы в их барабаны. */
  private hideWinSymbols(): void {
    this.reparentedSymbols.forEach((parent, symbol) => {
      symbol.idle()
      parent.reparentChild(symbol.view)
    })

    this.reparentedSymbols.clear()
  }

  /** Снимает показ целиком, вызывается в конце каждой стадии и при отмене. */
  private reset(): void {
    if (this.destroyed) return

    this.hidePaylines()
    this.hideWinFrames()
    this.hideWinSymbols()
  }

  // TODO линии выплат: ассетов пока нет, порядок вызовов в стадиях уже на месте
  private showPayline(_payline: Payline): void {}

  private hidePaylines(): void {}

  private showWinFrames(payline: Payline): void {
    payline.line.forEach((row, reel) => {
      if (row === null) return

      const winFrame = this.winFrames[reel]

      winFrame.view.position.set(CELL_WIDTH * reel, CELL_HEIGHT * row)

      winFrame.show()
    })
  }

  private hideWinFrames(): void {
    this.winFrames.forEach((winFrame) => winFrame.hide())
  }

  /** Показывает разом все выигравшие линии и их символы, затем гасит показ. */
  async showAllWins(symbolContainers: SymbolAnimation[][], signal?: AbortSignal): Promise<void> {
    const cells = new Set(this.paylines.flatMap((payline) => this.getPaylineSymbols(payline, symbolContainers)))

    try {
      this.showWinSymbols(Array.from(cells))
      this.paylines.forEach((payline) => this.showPayline(payline))

      await this.ticker.waitTicks(WIN_SHOWCASE_MS, signal)
    } finally {
      this.reset()
    }
  }

  /** Разбирает выигрыш по линиям: линия с символом, затем рамки с той же анимацией символа. */
  async playWinLines(symbolContainers: SymbolAnimation[][], signal?: AbortSignal): Promise<void> {
    try {
      for (const payline of this.paylines) {
        this.showWinSymbols(this.getPaylineSymbols(payline, symbolContainers))
        this.showPayline(payline)

        await this.ticker.waitTicks(PAYLINE_VISIBLE_MS, signal)

        this.hidePaylines()
        this.showWinFrames(payline)

        await this.ticker.waitTicks(WIN_FRAMES_VISIBLE_MS, signal)

        this.reset()
      }
    } finally {
      this.reset()
    }
  }
}
