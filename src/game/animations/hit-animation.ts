import type { GameTicker } from '../game-ticker'
import { SpineAnimation } from '../ui/spine-animation'

const SKELETON_URL = '/src/assets/game/animations/hit/hit.json'
const ATLAS_URL = '/src/assets/game/animations/hit/1/hit.atlas'

// ширина скелета из hit.json; origin арта — в его центре
const NATIVE_WIDTH = 354

const TRACK_MAIN = 0

export class HitAnimation extends SpineAnimation {
  private width = 0
  private height = 0

  constructor(ticker: GameTicker) {
    super(ticker)

    void this.load(SKELETON_URL, ATLAS_URL)
  }

  protected override onLoaded(): void {
    this.applySize()
  }

  /** Вписывает эффект попадания в зону: масштаб по ширине, центр скелета — в центр зоны. */
  resize(width: number, height: number): void {
    this.width = width
    this.height = height

    this.applySize()
  }

  /** Проигрывает эффект попадания один раз. */
  show(signal?: AbortSignal): Promise<void> {
    return this.playOnce(TRACK_MAIN, 'show', signal)
  }

  private applySize(): void {
    if (!this.spine || this.width === 0) return

    this.spine.scale.set(this.width / NATIVE_WIDTH)
    this.spine.position.set(this.width / 2, this.height / 2)
  }
}
