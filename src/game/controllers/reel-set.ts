import type { GameTicker } from 'src/game/game-ticker'
import { LiveContainer } from 'src/game/ui/live-container'
import type { SceneStore } from 'src/stores/scene-store'
import type { SymbolKey } from 'src/types/game'

import { ReelController } from './reel'

// Фиксируем константой количество барабанов как 5 и количество видимых символов в барабане как 3, потому что reel-frame не позволяет разместить больше
const REELS_COUNT = 5
const VISIBLE_SYMBOLS_COUNT = 3

// TODO позиционирует барабаны, готовит и передает данные в каждый барабан
// Предоставляет публичные методы для родителя для запуска анимаций барабанов последовательно с задержкой
// Так же возможно здесь будет позже описана freeze механика

export class ReelSetController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly sceneStore: SceneStore
  private containerWidth: number = 0
  private containerHeight: number = 0
  private reels: ReelController[] = []

  constructor(ticker: GameTicker, sceneStore: SceneStore) {
    super()

    this.ticker = ticker
    this.sceneStore = sceneStore

    this.watch(
      () => sceneStore.initialSymbols,
      (initialSymbols) => {
        if (!initialSymbols || this.reels.length) return

        this.reels = initialSymbols.map(() => new ReelController(ticker))
        initialSymbols.forEach((symbolKeys, index) => this.reels[index].setSymbols(symbolKeys))

        this.addChild(...this.reels)

        this.setupPosition()
      },
      { fireImmediately: true }
    )
  }

  private setupPosition() {
    const symbolCellWidth = this.containerWidth / REELS_COUNT
    const symbolCellHeight = this.containerHeight / VISIBLE_SYMBOLS_COUNT

    this.position.set(-this.containerWidth / 2 + symbolCellWidth / 2, -this.containerHeight / 2 + symbolCellHeight / 2)

    this.reels.forEach((reel, index) => {
      const reelOffset = symbolCellWidth * index

      reel.position.set(reelOffset, 0)
      reel.layout(symbolCellWidth, symbolCellHeight)
    })
  }

  setSymbols(symbols: SymbolKey[][] | undefined) {
    if (!symbols) return

    symbols.forEach((symbolKeys, index) => this.reels[index].setSymbols(symbolKeys))
  }

  layout(containerWidth: number, containerHeight: number) {
    this.containerWidth = containerWidth
    this.containerHeight = containerHeight
  }
}
