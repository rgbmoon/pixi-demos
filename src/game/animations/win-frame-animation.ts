import { EFFECT_ASSETS } from '../assets'
import { WIN_FRAME_SCALE } from '../constants'
import type { SpinePool } from '../spine-pool'
import { SpineAnimation } from '../ui/spine-animation'

const TRACK_MAIN = 0

export class WinFrameAnimation extends SpineAnimation {
  constructor(pool: SpinePool) {
    super(pool)

    this.attach(EFFECT_ASSETS.winFrame)

    this.view.scale.set(WIN_FRAME_SCALE)
  }

  show(): void {
    this.play(TRACK_MAIN, 'show', false)
  }

  hide(): void {
    this.clearTrack(TRACK_MAIN)
  }
}
