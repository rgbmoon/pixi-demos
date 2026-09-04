import { Assets, Container, Graphics, Sprite } from 'pixi.js'

import { REELS_FRAME_ALIAS } from '../assets'
import {
  REELS_ZONE_HEIGHT,
  REELS_ZONE_OFFSET_X,
  REELS_ZONE_OFFSET_Y,
  REELS_ZONE_WIDTH,
  TINT_ALPHA,
  TINT_FADE_MS,
} from '../constants'
import type { GameTicker } from '../game-ticker'
import { tweenAlpha } from '../utils'

export class ReelsFrameAnimation {
  readonly view = new Container()

  private readonly ticker: GameTicker
  private readonly symbolsContainer = new Container()
  private readonly symbolsWinContainer = new Container()
  private readonly popupContainer = new Container()
  private readonly tint = new Graphics()

  constructor(ticker: GameTicker) {
    this.ticker = ticker

    const frameSprite = new Sprite(Assets.get(REELS_FRAME_ALIAS))

    frameSprite.anchor.set(0.5)

    this.tint.rect(-REELS_ZONE_WIDTH / 2, -REELS_ZONE_HEIGHT / 2, REELS_ZONE_WIDTH, REELS_ZONE_HEIGHT).fill(0x000000)
    this.tint.alpha = 0

    // Слоты живут в координатах зоны символов: её центр смещён относительно центра арта рамки
    for (const layer of [this.symbolsContainer, this.tint, this.symbolsWinContainer, this.popupContainer]) {
      layer.position.set(REELS_ZONE_OFFSET_X, REELS_ZONE_OFFSET_Y)
    }

    this.view.addChild(frameSprite, this.symbolsContainer, this.tint, this.symbolsWinContainer, this.popupContainer)
  }

  showTint(signal?: AbortSignal): Promise<void> {
    return tweenAlpha(this.ticker, this.tint, TINT_ALPHA, TINT_FADE_MS, signal)
  }

  hideTint(signal?: AbortSignal): Promise<void> {
    return tweenAlpha(this.ticker, this.tint, 0, TINT_FADE_MS, signal)
  }

  addChildToSymbolsSlot(container: Container) {
    this.symbolsContainer.addChild(container)
  }

  addChildToSymbolsWinSlot(container: Container) {
    this.symbolsWinContainer.addChild(container)
  }

  addChildToPopupSlot(container: Container) {
    this.popupContainer.addChild(container)
  }
}
