import { Container } from 'pixi.js'
import { CELL_HEIGHT, CELL_WIDTH, REELS_COUNT } from 'src/games/slot/constants'
import type { WinCell } from 'src/games/slot/types'

import type { ReelSymbol } from './reel-symbol'
import { WinFrame } from './win-frame'

/**
 * Слой разбора выигрыша поверх барабанов: поднимает в себя выигравшие символы
 * и рисует рамки на их ячейках. Какие именно — решает владелец.
 */
export class WinOverlay extends Container {
  private readonly frames: WinFrame[]
  private readonly raised = new Map<ReelSymbol, Container>()

  constructor() {
    super()

    this.frames = Array.from({ length: REELS_COUNT }, () => new WinFrame())

    this.addChild(...this.frames)
  }

  /** Поднимает символы в оверлей и включает у них выигрышную анимацию. */
  raiseSymbols(symbols: ReelSymbol[]): void {
    symbols.forEach((symbol) => {
      const { parent } = symbol

      if (!parent) return

      this.raised.set(symbol, parent)
      this.reparentChild(symbol)

      symbol.win()
    })
  }

  /** Глушит выигрышную анимацию и возвращает символы в их барабаны. */
  dropSymbols(): void {
    this.raised.forEach((parent, symbol) => {
      symbol.idle()
      parent.reparentChild(symbol)
    })

    this.raised.clear()
  }

  showFrames(cells: WinCell[]): void {
    cells.forEach(({ reel, row }) => {
      const frame = this.frames[reel]

      frame.position.set(CELL_WIDTH * reel, CELL_HEIGHT * row)

      frame.show()
    })
  }

  hideFrames(): void {
    this.frames.forEach((frame) => frame.hide())
  }

  /** Снимает показ целиком: и рамки, и поднятые символы. */
  clear(): void {
    if (this.destroyed) return

    this.hideFrames()
    this.dropSymbols()
  }
}
