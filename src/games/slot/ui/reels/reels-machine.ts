import { Container, Graphics } from 'pixi.js'
import type { GameTicker } from 'src/engine/game-ticker'
import type { SpinePool } from 'src/engine/spine-pool'
import {
  CELL_HEIGHT,
  CELL_WIDTH,
  CELLS_ORIGIN_X,
  CELLS_ORIGIN_Y,
  LAND_STAGGER_CELLS,
  REELS_COUNT,
  REELS_ZONE_HEIGHT,
  REELS_ZONE_WIDTH,
} from 'src/games/slot/constants'
import type { SymbolKey } from 'src/games/slot/types'

import { Reel } from './reel'
import type { ReelSymbol } from './reel-symbol'
import { ReelsFrame } from './reels-frame'

/**
 * Машина барабанов: рамка, замаскированный слой лент и сами ленты.
 * Умеет крутиться и садиться на переданные символы; откуда символы — не знает.
 */
export class ReelsMachine extends Container {
  private readonly frame: ReelsFrame
  private readonly reelsLayer = new Container()
  private readonly maskGraphics = new Graphics()
  private readonly reels: Reel[]

  constructor(ticker: GameTicker, pool: SpinePool) {
    super()

    this.reels = Array.from({ length: REELS_COUNT }, () => new Reel(ticker, pool))

    this.setupReelsLayer()

    this.frame = new ReelsFrame(ticker)
    this.frame.addChildToSymbolsSlot(this.reelsLayer)

    this.addChild(this.frame)
  }

  /** Кладёт слой поверх символов: разбор выигрыша и линии приходят снаружи, порядок вызовов — их порядок. */
  addOverlay(overlay: Container): void {
    overlay.position.set(CELLS_ORIGIN_X, CELLS_ORIGIN_Y)

    this.frame.addChildToSymbolsWinSlot(overlay)
  }

  /** Видимые символы поля по барабанам — сетка, по которой владелец ищет выигравшие ячейки. */
  get visibleSymbols(): ReelSymbol[][] {
    return this.reels.map((reel) => reel.visibleSymbols)
  }

  setSymbols(symbols: SymbolKey[][]): void {
    symbols.forEach((symbolKeys, index) => this.reels[index].setSymbols(symbolKeys))
  }

  spin(): void {
    this.reels.forEach((reel) => reel.spin())
  }

  /** Сажает ленты лесенкой: каждая следующая крутится на `LAND_STAGGER_CELLS` ячеек дольше. */
  async land(symbolKeys: SymbolKey[][] | undefined, signal?: AbortSignal): Promise<void> {
    await Promise.all(
      this.reels.map((reel, index) => reel.land(symbolKeys?.[index] ?? [], index * LAND_STAGGER_CELLS, signal))
    )
  }

  showTint(signal?: AbortSignal): Promise<void> {
    return this.frame.showTint(signal)
  }

  hideTint(signal?: AbortSignal): Promise<void> {
    return this.frame.hideTint(signal)
  }

  private setupReelsLayer(): void {
    this.maskGraphics.rect(-CELL_WIDTH / 2, -CELL_HEIGHT / 2, REELS_ZONE_WIDTH, REELS_ZONE_HEIGHT).fill(0xffffff)

    this.reelsLayer.position.set(CELLS_ORIGIN_X, CELLS_ORIGIN_Y)
    this.reelsLayer.mask = this.maskGraphics
    this.reelsLayer.addChild(this.maskGraphics, ...this.reels)

    this.reels.forEach((reel, index) => reel.position.set(CELL_WIDTH * index, 0))
  }
}
