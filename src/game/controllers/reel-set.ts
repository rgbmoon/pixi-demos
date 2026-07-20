import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import type { GameTicker } from 'src/game/game-ticker'
import { LiveContainer } from 'src/game/ui/live-container'
import type { SceneStore } from 'src/stores/scene-store'
import type { SymbolKey } from 'src/types/game'

import { SymbolAnimation } from '../animations/symbol-animation'

const REELS = 5
const VISIBLE_CELLS = 3
const CELLS = VISIBLE_CELLS + 2

// TODO - сделать методы для кручения барабанов и отображения данных на основе кручения (выводим из стора или результат спина если есть или initial данные)

@injectable()
export class ReelSetController extends LiveContainer {
  private readonly symbolsGrid: SymbolAnimation[][]

  constructor(@inject(TOKENS.GameTicker) ticker: GameTicker, @inject(TOKENS.SceneStore) sceneStore: SceneStore) {
    super()

    this.symbolsGrid = Array.from({ length: REELS }, () =>
      Array.from({ length: CELLS }, (_, cell) => {
        const symbol = new SymbolAnimation(ticker, cell > 0 && cell < CELLS - 1)

        this.addChild(symbol.view)

        return symbol
      })
    )

    this.watch(
      () => sceneStore.symbols,
      (symbols) => this.showSymbols(symbols),
      { fireImmediately: true }
    )
  }

  // Получаем ширину и высоту от родительского контейнера
  layout(width: number, height: number): void {
    const cellWidth = width / REELS
    const cellHeight = height / VISIBLE_CELLS

    this.symbolsGrid.forEach((reel, reelIndex) => {
      reel.forEach((symbol, cellIndex) => {
        symbol.resize(cellWidth, cellHeight)
        // сдвиг на ячейку вверх: видимые ячейки занимают зону, скрытые уходят за её края
        symbol.view.position.set(reelIndex * cellWidth, (cellIndex - 1) * cellHeight)
      })
    })
  }

  private showSymbols(symbols: SymbolKey[][] | undefined): void {
    if (!symbols) return

    symbols.forEach((reel, reelIndex) => {
      reel.forEach((key, cellIndex) => {
        // сервер присылает только видимые ячейки — они начинаются со второй
        this.symbolsGrid[reelIndex]?.[cellIndex + 1]?.setKey(key)
      })
    })
  }
}
