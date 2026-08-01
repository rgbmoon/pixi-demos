import { BACKGROUND_ASSET } from '../assets'
import { BACKGROUND_CROP_Y, BACKGROUND_HEIGHT, BACKGROUND_WIDTH } from '../constants'
import type { SpinePool } from '../spine-pool'
import { SpineAnimation } from '../ui/spine-animation'

const TRACK_MAIN = 0

export class BackgroundAnimation extends SpineAnimation {
  constructor(pool: SpinePool, animationName: string) {
    super(pool)

    this.attach(BACKGROUND_ASSET)
    this.play(TRACK_MAIN, animationName)
  }

  /**
   * Вписывает фон в канвас: по вертикали за кадр уходит `BACKGROUND_CROP_Y` сверху и снизу,
   * по горизонтали срез больше — канвас уже фона.
   */
  resize(width: number, height: number): void {
    const visibleHeight = BACKGROUND_HEIGHT * (1 - 2 * BACKGROUND_CROP_Y)

    this.view.scale.set(Math.max(width / BACKGROUND_WIDTH, height / visibleHeight))
    this.view.position.set(width / 2, height / 2)
  }
}
