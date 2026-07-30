import { inject, injectable } from 'inversify'
import { Container, Graphics } from 'pixi.js'
import { TOKENS } from 'src/constants/tokens'
import { ReelsFrameAnimation } from 'src/game/animations/reels-frame-animation'
import type { SymbolAnimation } from 'src/game/animations/symbol-animation'
import {
  CELL_HEIGHT,
  CELL_WIDTH,
  CELLS_ORIGIN_X,
  CELLS_ORIGIN_Y,
  LAND_STAGGER_CELLS,
  REELS_COUNT,
  REELS_MACHINE_SCALE,
  REELS_ZONE_HEIGHT,
  REELS_ZONE_WIDTH,
} from 'src/game/constants'
import type { GameTicker } from 'src/game/game-ticker'
import type { SpinePool } from 'src/game/spine-pool'
import { LiveContainer } from 'src/game/ui/live-container'
import type { SceneStore } from 'src/stores/scene-store'
import type { SymbolKey } from 'src/types/game'

import { ReelController } from './reel'
import { ReelsWinOverlayController } from './reels-win-overlay'

@injectable()
export class ReelsMachineController extends LiveContainer {
  private readonly reelsFrameAnimation: ReelsFrameAnimation
  private readonly reelsWinOverlay: ReelsWinOverlayController
  private readonly reelsLayer = new Container()
  private readonly maskGraphics = new Graphics()
  private readonly reels: ReelController[]

  constructor(
    @inject(TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOKENS.SpinePool) pool: SpinePool,
    @inject(TOKENS.SceneStore) sceneStore: SceneStore
  ) {
    super()

    this.reels = Array.from({ length: REELS_COUNT }, () => new ReelController(ticker, pool))
    this.setupReelsLayer()

    this.reelsWinOverlay = new ReelsWinOverlayController(ticker, sceneStore)
    this.reelsWinOverlay.position.set(CELLS_ORIGIN_X, CELLS_ORIGIN_Y)

    this.reelsFrameAnimation = new ReelsFrameAnimation(pool)

    this.reelsFrameAnimation.addChildToSymbolsSlot(this.reelsLayer)
    this.reelsFrameAnimation.addChildToSymbolsWinSlot(this.reelsWinOverlay)

    this.scale.set(REELS_MACHINE_SCALE)
    this.addChild(this.reelsFrameAnimation.view)

    this.watch(
      () => sceneStore.initialSymbols,
      (initialSymbols) => this.setSymbols(initialSymbols),
      {
        fireImmediately: true,
      }
    )
  }

  private setupReelsLayer() {
    this.maskGraphics.rect(-CELL_WIDTH / 2, -CELL_HEIGHT / 2, REELS_ZONE_WIDTH, REELS_ZONE_HEIGHT).fill(0xffffff)

    this.reelsLayer.position.set(CELLS_ORIGIN_X, CELLS_ORIGIN_Y)
    this.reelsLayer.mask = this.maskGraphics
    this.reelsLayer.addChild(this.maskGraphics, ...this.reels)

    this.reels.forEach((reel, index) => reel.position.set(CELL_WIDTH * index, 0))
  }

  private setSymbols(symbols: SymbolKey[][] | undefined) {
    if (!symbols) return

    symbols.forEach((symbolKeys, index) => this.reels[index].setSymbols(symbolKeys))
  }

  get symbolContainers(): SymbolAnimation[][] {
    return this.reels.map((reel) => reel.visibleSymbols)
  }

  spin() {
    this.reels.forEach((reel) => reel.spin())
  }

  async land(symbolKeys: SymbolKey[][] | undefined, signal?: AbortSignal): Promise<void> {
    await Promise.all(
      this.reels.map((reel, index) => reel.land(symbolKeys?.[index] ?? [], index * LAND_STAGGER_CELLS, signal))
    )
  }

  showTint(signal?: AbortSignal): Promise<void> {
    return this.reelsFrameAnimation.showTint(signal)
  }

  hideTint(signal?: AbortSignal): Promise<void> {
    return this.reelsFrameAnimation.hideTint(signal)
  }

  showAllWins(signal?: AbortSignal): Promise<void> {
    return this.reelsWinOverlay.showAllWins(this.symbolContainers, signal)
  }

  playWinLines(signal?: AbortSignal): Promise<void> {
    return this.reelsWinOverlay.playWinLines(this.symbolContainers, signal)
  }
}
