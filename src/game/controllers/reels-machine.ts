import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import { ReelsFrameAnimation } from 'src/game/animations/reels-frame-animation'
import { REELS_MACHINE_SCALE, REELS_ZONE_HEIGHT, REELS_ZONE_WIDTH } from 'src/game/constants'
import type { GameTicker } from 'src/game/game-ticker'
import type { SpinePool } from 'src/game/spine-pool'
import { LiveContainer } from 'src/game/ui/live-container'
import type { SceneStore } from 'src/stores/scene-store'
import type { SymbolKey } from 'src/types/game'

import { ReelSetController } from './reel-set'
import { WinFramesController } from './win-frames'
import { WinSymbolsController } from './win-symbols'

@injectable()
export class ReelsMachineController extends LiveContainer {
  private readonly reelsFrameAnimation: ReelsFrameAnimation
  private readonly reelSet: ReelSetController
  private readonly winSymbols: WinSymbolsController
  private readonly winFrames: WinFramesController

  constructor(
    @inject(TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOKENS.SpinePool) pool: SpinePool,
    @inject(TOKENS.SceneStore) sceneStore: SceneStore
  ) {
    super()

    this.reelsFrameAnimation = new ReelsFrameAnimation(pool)

    this.scale.set(REELS_MACHINE_SCALE)

    this.reelSet = new ReelSetController(ticker, pool, sceneStore)
    this.reelSet.layout(REELS_ZONE_WIDTH, REELS_ZONE_HEIGHT)

    this.winSymbols = new WinSymbolsController(ticker, pool, sceneStore)
    this.winSymbols.layout(REELS_ZONE_WIDTH, REELS_ZONE_HEIGHT)

    this.winFrames = new WinFramesController(ticker, pool, sceneStore)
    this.winFrames.layout(REELS_ZONE_WIDTH, REELS_ZONE_HEIGHT)

    this.reelsFrameAnimation.addChildToSymbolsSlot(this.reelSet)
    this.reelsFrameAnimation.addChildToSymbolsWinSlot(this.winSymbols)

    this.addChild(this.reelsFrameAnimation.view)
  }

  spin() {
    this.reelSet.spin()
  }

  land(symbolKeys: SymbolKey[][] | undefined, signal?: AbortSignal): Promise<void> {
    return this.reelSet.land(symbolKeys, signal)
  }

  showTint() {
    this.reelsFrameAnimation.showTint()
  }

  hideTint() {
    this.reelsFrameAnimation.hideTint()
  }

  showWinSymbols() {
    this.winSymbols.showWinSymbols()
  }

  hideWinSymbols() {
    this.winSymbols.hideWinSymbols()
  }

  showWinFrames() {
    this.winFrames.showWinFrames()
  }

  hideWinFrames() {
    this.winFrames.hideWinFrames()
  }

  // TODO описать методы для paylines когда будут готовы
}
