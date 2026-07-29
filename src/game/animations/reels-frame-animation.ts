import { Container } from 'pixi.js'

import { FRAME_ASSET } from '../assets'
import type { SpinePool } from '../spine-pool'
import { SpineAnimation } from '../ui/spine-animation'

const TRACK_MAIN = 0
const TRACK_TINT = 1

export class ReelsFrameAnimation extends SpineAnimation {
  private readonly symbolsContainer: Container = new Container()
  private readonly symbolsWinContainer: Container = new Container()
  private readonly popupContainer: Container = new Container()

  constructor(pool: SpinePool) {
    super(pool)

    this.attach(FRAME_ASSET)

    this.play(TRACK_MAIN, 'idle')

    this.spine?.addSlotObject('symbols_placeholder', this.symbolsContainer)
    this.spine?.addSlotObject('symbols_win_placeholder', this.symbolsWinContainer)
    this.spine?.addSlotObject('popup_placeholder', this.popupContainer)
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
