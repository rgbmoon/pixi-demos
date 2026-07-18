import type { GameTicker } from '../game-ticker'
import { SpineAnimation } from '../ui/spine-animation'

const SKELETON_URL = '/src/assets/game/animations/hero/hero.json'
const ATLAS_URL = '/src/assets/game/animations/hero/1/hero.atlas'

// ширина скелета из hero.json; origin арта — в его центре
const NATIVE_WIDTH = 338.06

const TRACK_MAIN = 0

type HeroFacing = 'left' | 'right'

export class HeroAnimation extends SpineAnimation {
  private width = 0
  private height = 0
  private facing: HeroFacing = 'right'

  constructor(ticker: GameTicker) {
    super(ticker)

    void this.load(SKELETON_URL, ATLAS_URL)
  }

  protected override onLoaded(): void {
    this.play(TRACK_MAIN, 'fly_right')
    this.applySize()
  }

  /** Вписывает джинна в зону: масштаб по ширине, центр скелета — в центр зоны. */
  resize(width: number, height: number): void {
    this.width = width
    this.height = height

    this.applySize()
  }

  /** Полёт влево, цикл. */
  flyLeft(): void {
    this.facing = 'left'
    this.play(TRACK_MAIN, 'fly_left')
  }

  /** Полёт вправо, цикл. */
  flyRight(): void {
    this.facing = 'right'
    this.play(TRACK_MAIN, 'fly_right')
  }

  /** Разворот налево из текущего полёта, затем цикл полёта влево. */
  async turnToLeft(signal?: AbortSignal): Promise<void> {
    await this.playOnce(TRACK_MAIN, 'to_left', signal)
    this.flyLeft()
  }

  /** Разворот направо из текущего полёта, затем цикл полёта вправо. */
  async turnToRight(signal?: AbortSignal): Promise<void> {
    await this.playOnce(TRACK_MAIN, 'to_right', signal)
    this.flyRight()
  }

  /** Выстрел влево, затем возврат к полёту в текущем направлении. */
  async shootLeft(signal?: AbortSignal): Promise<void> {
    await this.playOnce(TRACK_MAIN, 'shoot_left', signal)
    this.play(TRACK_MAIN, this.facing === 'left' ? 'fly_left' : 'fly_right')
  }

  /** Выстрел вправо, затем возврат к полёту в текущем направлении. */
  async shootRight(signal?: AbortSignal): Promise<void> {
    await this.playOnce(TRACK_MAIN, 'shoot_right', signal)
    this.play(TRACK_MAIN, this.facing === 'left' ? 'fly_left' : 'fly_right')
  }

  private applySize(): void {
    if (!this.spine || this.width === 0) return

    this.spine.scale.set(this.width / NATIVE_WIDTH)
    this.spine.position.set(this.width / 2, this.height / 2)
  }
}
