import type { GameTicker } from '../game-ticker'
import { SpineAnimation } from '../ui/spine-animation'

const SKELETON_URL = '/src/assets/game/animations/shooting/shooting.json'
const ATLAS_URL = '/src/assets/game/animations/shooting/1/shooting.atlas'

// ширина скелета из shooting.json; origin арта — в его центре
const NATIVE_WIDTH = 411.86

const TRACK_MAIN = 0

export class ShootingAnimation extends SpineAnimation {
  private width = 0
  private height = 0

  constructor(ticker: GameTicker) {
    super(ticker)

    void this.load(SKELETON_URL, ATLAS_URL)
  }

  protected override onLoaded(): void {
    this.applySize()
  }

  /** Вписывает прожектайл в зону: масштаб по ширине, центр скелета — в центр зоны. */
  resize(width: number, height: number): void {
    this.width = width
    this.height = height

    this.applySize()
  }

  /** Проигрывает полёт прожектайла один раз. */
  shoot(signal?: AbortSignal): Promise<void> {
    return this.playOnce(TRACK_MAIN, 'shooting', signal)
  }

  private applySize(): void {
    if (!this.spine || this.width === 0) return

    this.spine.scale.set(this.width / NATIVE_WIDTH)
    this.spine.position.set(this.width / 2, this.height / 2)
  }
}
