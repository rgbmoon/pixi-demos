import type { GameTicker } from '../game-ticker'
import { SpineAnimation } from './spine-animation'

const SKELETON_URL = '/src/assets/game/animations/reels_frame/frame.json'
const ATLAS_URL = '/src/assets/game/animations/reels_frame/1/frame.atlas'

// ширина скелета из frame.json; origin арта — в его центре
const NATIVE_WIDTH = 1074.93

const TRACK_MAIN = 0
const TRACK_TINT = 1

/** Spine-рамка барабанов: idle-контур на основном треке, затемнение символов — на отдельном. */
export class ReelsFrameAnimation extends SpineAnimation {
  private width = 0
  private height = 0

  constructor(ticker: GameTicker) {
    super(ticker)

    void this.load(SKELETON_URL, ATLAS_URL)
  }

  protected override onLoaded(): void {
    this.play(TRACK_MAIN, 'idle')
    this.applySize()
  }

  /** Вписывает рамку в зону барабанов: масштаб по ширине, центр скелета — в центр зоны. */
  resize(width: number, height: number): void {
    this.width = width
    this.height = height

    this.applySize()
  }

  /** Показывает затемнение символов и держит его до `hideTint`. */
  async showTint(signal?: AbortSignal): Promise<void> {
    await this.playOnce(TRACK_TINT, 'tint_show', signal)

    this.play(TRACK_TINT, 'tint_idle')
  }

  /** Прячет затемнение символов. */
  async hideTint(signal?: AbortSignal): Promise<void> {
    await this.playOnce(TRACK_TINT, 'tint_hide', signal)

    this.clearTrack(TRACK_TINT)
  }

  private applySize(): void {
    if (!this.spine || this.width === 0) return

    this.spine.scale.set(this.width / NATIVE_WIDTH)
    this.spine.position.set(this.width / 2, this.height / 2)
  }
}
