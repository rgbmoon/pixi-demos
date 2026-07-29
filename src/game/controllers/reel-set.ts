import { Graphics } from 'pixi.js'
import { LAND_STAGGER_CELLS, REELS_COUNT, VISIBLE_SYMBOLS_COUNT } from 'src/game/constants'
import type { GameTicker } from 'src/game/game-ticker'
import type { SpinePool } from 'src/game/spine-pool'
import { LiveContainer } from 'src/game/ui/live-container'
import type { SceneStore } from 'src/stores/scene-store'
import type { SymbolKey } from 'src/types/game'

import { ReelController } from './reel'

export class ReelSetController extends LiveContainer {
  private readonly maskGraphics = new Graphics()
  private containerWidth: number = 0
  private containerHeight: number = 0
  private reels: ReelController[] = []

  constructor(ticker: GameTicker, pool: SpinePool, sceneStore: SceneStore) {
    super()

    this.addChild(this.maskGraphics)
    this.mask = this.maskGraphics

    this.watch(
      () => sceneStore.initialSymbols,
      (initialSymbols) => {
        if (!initialSymbols || this.reels.length) return

        this.reels = initialSymbols.map(() => new ReelController(ticker, pool))
        initialSymbols.forEach((symbolKeys, index) => this.reels[index].setSymbols(symbolKeys))

        this.addChild(...this.reels)

        this.setupPosition()
      },
      { fireImmediately: true }
    )
  }

  /** Ширина ячейки символа: зона делится поровну между барабанами. */
  private get cellWidth(): number {
    return this.containerWidth / REELS_COUNT
  }

  /** Высота ячейки символа: зона делится поровну между видимыми символами. */
  private get cellHeight(): number {
    return this.containerHeight / VISIBLE_SYMBOLS_COUNT
  }

  private setupPosition() {
    this.position.set(-this.containerWidth / 2 + this.cellWidth / 2, -this.containerHeight / 2 + this.cellHeight / 2)

    this.reels.forEach((reel, index) => {
      const reelOffset = this.cellWidth * index

      reel.position.set(reelOffset, 0)
      reel.layout(this.cellHeight)
    })
  }

  private drawMask() {
    this.maskGraphics
      .clear()
      .rect(-this.cellWidth / 2, -this.cellHeight / 2, this.containerWidth, this.containerHeight)
      .fill(0xffffff)
  }

  spin() {
    this.reels.forEach((reel) => reel.spin())
  }

  // TODO доработать на случай если промис упадет
  async land(symbolKeys: SymbolKey[][] | undefined, signal?: AbortSignal): Promise<void> {
    await Promise.all(
      this.reels.map((reel, index) => reel.land(symbolKeys?.[index] ?? [], index * LAND_STAGGER_CELLS, signal))
    )
  }

  setSymbols(symbols: SymbolKey[][] | undefined) {
    if (!symbols) return

    symbols.forEach((symbolKeys, index) => this.reels[index].setSymbols(symbolKeys))
  }

  layout(containerWidth: number, containerHeight: number) {
    this.containerWidth = containerWidth
    this.containerHeight = containerHeight

    this.drawMask()
  }
}
