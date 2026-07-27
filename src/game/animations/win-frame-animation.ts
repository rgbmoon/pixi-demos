import { EFFECT_ASSETS } from '../assets'
import { SpineAnimation } from '../ui/spine-animation'

// ширина скелета из win_frame.json; origin арта — в его центре
const NATIVE_WIDTH = 228.61

const TRACK_MAIN = 0

export class WinFrameAnimation extends SpineAnimation {
  private width = 0
  private height = 0

  constructor() {
    super()

    this.attach(EFFECT_ASSETS.winFrame.skeletonUrl, EFFECT_ASSETS.winFrame.atlasUrl)
    this.applySize()
  }

  /** Вписывает вин-рамку в зону: масштаб по ширине, центр скелета — в центр зоны. */
  resize(width: number, height: number): void {
    this.width = width
    this.height = height

    this.applySize()
  }

  /** Проигрывает вин-рамку один раз. */
  show(signal?: AbortSignal): Promise<void> {
    return this.playOnce(TRACK_MAIN, 'show', signal)
  }

  private applySize(): void {
    if (!this.spine || this.width === 0) return

    this.spine.scale.set(this.width / NATIVE_WIDTH)
    this.spine.position.set(this.width / 2, this.height / 2)
  }
}
