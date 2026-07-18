import type { GameTicker } from '../game-ticker'
import { SpineAnimation } from '../ui/spine-animation'

const SKELETON_URL = '/src/assets/game/animations/frozen_reel/frozen_reel.json'
const ATLAS_URL = '/src/assets/game/animations/frozen_reel/1/frozen_reel.atlas'

// ширина скелета из frozen_reel.json; origin арта — в его центре
const NATIVE_WIDTH = 271.27

const TRACK_MAIN = 0

export class FrozenReelAnimation extends SpineAnimation {
  private width = 0
  private height = 0

  constructor(ticker: GameTicker) {
    super(ticker)

    void this.load(SKELETON_URL, ATLAS_URL)
  }

  protected override onLoaded(): void {
    this.applySize()
  }

  /** Вписывает эффект заморозки в зону барабана: масштаб по ширине, центр скелета — в центр зоны. */
  resize(width: number, height: number): void {
    this.width = width
    this.height = height

    this.applySize()
  }

  /** Показывает заморозку барабана и держит её до `hideFreeze`. */
  async showFreeze(signal?: AbortSignal): Promise<void> {
    await this.playOnce(TRACK_MAIN, 'show', signal)

    this.play(TRACK_MAIN, 'idle')
  }

  /** Снимает заморозку барабана. */
  async hideFreeze(signal?: AbortSignal): Promise<void> {
    await this.playOnce(TRACK_MAIN, 'hide', signal)

    this.clearTrack(TRACK_MAIN)
  }

  private applySize(): void {
    if (!this.spine || this.width === 0) return

    this.spine.scale.set(this.width / NATIVE_WIDTH)
    this.spine.position.set(this.width / 2, this.height / 2)
  }
}
