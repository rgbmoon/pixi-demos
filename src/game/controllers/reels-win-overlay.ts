import type { Container } from 'pixi.js'
import type { Payline } from 'src/api/root-api'
import { PAYLINE_VISIBLE_MS, WIN_FRAMES_VISIBLE_MS, WIN_SHOWCASE_MS } from 'src/game/constants'
import type { GameTicker } from 'src/game/game-ticker'
import { LiveContainer } from 'src/game/ui/live-container'
import type { SceneStore } from 'src/stores/scene-store'

import type { SymbolAnimation } from '../animations/symbol-animation'

export class ReelsWinOverlayController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly reparentedSymbols = new Map<SymbolAnimation, Container>()
  private paylines: SceneStore['spinPaylines'] = []

  constructor(ticker: GameTicker, sceneStore: SceneStore) {
    super()

    this.ticker = ticker

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

  // TODO вин-рамки: WinFrameAnimation готова, осталось разложить её по ячейкам линии
  private showWinFrames(_payline: Payline): void {}

  private hideWinFrames(): void {}

  /** Показывает разом все выигравшие линии и их символы, затем гасит показ. */
  async showAllWins(grid: SymbolAnimation[][], signal?: AbortSignal): Promise<void> {
    const cells = new Set(this.paylines.flatMap((payline) => this.getPaylineSymbols(payline, grid)))

    try {
      this.showWinSymbols(Array.from(cells))
      this.paylines.forEach((payline) => this.showPayline(payline))

      await this.ticker.waitTicks(WIN_SHOWCASE_MS, signal)
    } finally {
      this.reset()
    }
  }

  /** Разбирает выигрыш по линиям: линия с символом, затем рамки с той же анимацией символа. */
  async playWinLines(grid: SymbolAnimation[][], signal?: AbortSignal): Promise<void> {
    try {
      for (const payline of this.paylines) {
        this.showWinSymbols(this.getPaylineSymbols(payline, grid))
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
