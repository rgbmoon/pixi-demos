import { inject, injectable } from 'inversify'
import type { SpinResponse } from 'src/api/root-api'
import { TOKENS } from 'src/constants/tokens'
import { ReelsFrameAnimation } from 'src/game/animations/reels-frame-animation'
import type { GameTicker } from 'src/game/game-ticker'
import { LiveContainer } from 'src/game/ui/live-container'

import type { ReelSetController } from './reel-set'

@injectable()
export class ReelsMachineController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly reelsFrameAnimation: ReelsFrameAnimation
  private readonly reelSet: ReelSetController

  constructor(
    @inject(TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOKENS.ReelSetController) reelSet: ReelSetController
  ) {
    super()

    this.ticker = ticker
    this.reelsFrameAnimation = new ReelsFrameAnimation(ticker)
    this.reelSet = reelSet

    this.addChild(reelSet, this.reelsFrameAnimation.view)
  }

  layout(width: number, height: number): void {
    this.reelsFrameAnimation.resize(width, height)

    const zone = this.reelsFrameAnimation.getSymbolsZone()

    this.reelSet.position.set(zone.x, zone.y)
    this.reelSet.layout(zone.width, zone.height)
  }

  spin(signal?: AbortSignal): Promise<void> {
    return this.ticker.waitTicks(300, signal)
  }

  land(_result: SpinResponse, signal?: AbortSignal): Promise<void> {
    return this.ticker.waitTicks(300, signal)
  }

  showTint(signal?: AbortSignal): Promise<void> {
    return this.reelsFrameAnimation.showTint(signal)
  }

  hideTint(signal?: AbortSignal): Promise<void> {
    return this.reelsFrameAnimation.hideTint(signal)
  }
}
