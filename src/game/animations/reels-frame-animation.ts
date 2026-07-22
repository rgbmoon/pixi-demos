import { Container } from 'pixi.js'

import type { GameTicker } from '../game-ticker'
import { SpineAnimation } from '../ui/spine-animation'

const SKELETON_URL = '/src/assets/game/animations/reels_frame/frame.json'
const ATLAS_URL = '/src/assets/game/animations/reels_frame/1/frame.atlas'

const TRACK_MAIN = 0
const TRACK_TINT = 1

export class ReelsFrameAnimation extends SpineAnimation {
  private readonly symbolsContainer: Container = new Container()
  private readonly symbolsWinContainer: Container = new Container()
  private readonly popupContainer: Container = new Container()

  constructor(ticker: GameTicker) {
    super(ticker)

    void this.load(SKELETON_URL, ATLAS_URL)
  }

  protected override onLoaded(): void {
    this.play(TRACK_MAIN, 'idle')

    if (this.spine) {
      this.spine.addSlotObject('symbols_placeholder', this.symbolsContainer)
      this.spine.addSlotObject('symbols_win_placeholder', this.symbolsWinContainer)
      this.spine.addSlotObject('popup_placeholder', this.popupContainer)
    }
  }

  async showTint(signal?: AbortSignal): Promise<void> {
    await this.playOnce(TRACK_TINT, 'tint_show', signal)

    this.play(TRACK_TINT, 'tint_idle')
  }

  async hideTint(signal?: AbortSignal): Promise<void> {
    await this.playOnce(TRACK_TINT, 'tint_hide', signal)

    this.clearTrack(TRACK_TINT)
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
