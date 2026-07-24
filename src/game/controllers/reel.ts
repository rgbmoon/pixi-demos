import type { GameTicker } from 'src/game/game-ticker'
import { LiveContainer } from 'src/game/ui/live-container'
import type { SymbolKey } from 'src/types/game'

import { VISIBLE_SYMBOLS_COUNT } from './reel-set'
import { SymbolAnimation } from '../animations/symbol-animation'

const BUFFER_SYMBOLS_COUNT = 1

// TODO позиционирует свои символы, реализует анимацию вращения, отображает данные барабана, переданные от родителя

// Анимация вращения скорее всего строится через функцию на сдвиг контейнера символа(или всего барабана) и передачи этой функции коллбеком в тикер
// Так же надо на время вращения заполнять рандомными символами. И так же нужна маска, которая будет скрывать уезжающие вниз символы
// И нужно предусмотреть пару технических символо сверху и снизу
// Сама анимация длится N милисекунд и затем перед остановкой в нее подкидываются реальные значения символов.
// Анимация пока простая, без отскоков барабана и тд
// Анимация проигрывается либо N ms, либо пока промис не зарезолвится

export class ReelController extends LiveContainer {
  private ticker: GameTicker
  private symbols: SymbolAnimation[] = []
  private symbolKeys: SymbolKey[] = []

  constructor(ticker: GameTicker) {
    super()

    this.ticker = ticker

    this.symbols = Array.from(
      { length: VISIBLE_SYMBOLS_COUNT + BUFFER_SYMBOLS_COUNT * 2 },
      () => new SymbolAnimation(ticker)
    )
    this.addChild(...this.symbols.map((animation) => animation.view))
  }

  setSymbols(symbolKeys: SymbolKey[]) {
    this.symbolKeys = symbolKeys

    symbolKeys.forEach((key, index) => this.symbols[index + BUFFER_SYMBOLS_COUNT].setKey(key))

    this.symbolKeys.forEach((key, index) => this.symbols[index + BUFFER_SYMBOLS_COUNT].setKey(key))
  }

  layout(_symbolCellWidth: number, symbolCellHeight: number) {
    this.symbols.forEach((symbol, index) => {
      const symbolVerticalOffset = symbolCellHeight * (index - BUFFER_SYMBOLS_COUNT)

      symbol.view.position.set(0, symbolVerticalOffset)
    })
  }
}
