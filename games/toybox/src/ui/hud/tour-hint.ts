import { Assets, type Sprite, type Spritesheet } from 'pixi.js'

import { HUD_ATLAS } from '#src/assets'
import { TOUR_HINT_FRAME_MS } from '#src/constants'
import { FrameAnimation } from '@pixi-demos/engine/frame-animation'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import type { FrameSequence } from '@pixi-demos/engine/types'

/** Стрелки тура по управлению: пока тур идёт, кадры стрелок крутятся по кругу, после тура стрелки скрыты. */
export class TourHint extends FrameAnimation {
  private readonly sequence: FrameSequence

  constructor(ticker: GameTicker, carrier: Sprite, sequence: string) {
    super(ticker, carrier)

    this.sequence = { frames: Assets.get<Spritesheet>(HUD_ATLAS).animations[sequence], durations: TOUR_HINT_FRAME_MS }
    this.visible = false
  }

  /** Показывает стрелки или прячет их. */
  setShown(shown: boolean): void {
    if (shown === this.visible) return

    this.visible = shown

    if (shown) this.play(this.sequence)
    else this.stop()
  }
}
