import type { GameTicker } from '../game-ticker'
import { SpineAnimation } from '../ui/spine-animation'

const SKELETON_URL = '/src/assets/game/animations/symbols/scatter/scatter.json'
const ATLAS_URL = '/src/assets/game/animations/symbols/scatter/1/scatter.atlas'

// ширина скелета из scatter.json; origin арта — в его центре
const NATIVE_WIDTH = 219.77

const TRACK_MAIN = 0

export class ScatterAnimation extends SpineAnimation {
  private width = 0
  private height = 0

  constructor(ticker: GameTicker) {
    super(ticker)

    void this.load(SKELETON_URL, ATLAS_URL)
  }

  protected override onLoaded(): void {
    this.play(TRACK_MAIN, 'idle_1')
    this.applySize()
  }

  /** Вписывает скаттер в ячейку барабана: масштаб по ширине, центр скелета — в центр ячейки. */
  resize(width: number, height: number): void {
    this.width = width
    this.height = height

    this.applySize()
  }

  /** Статичный смазанный кадр — для символа во время вращения барабана. */
  blur(): void {
    this.play(TRACK_MAIN, 'blur')
  }

  /** Простой с надписью scatter. */
  idleLamp(): void {
    this.play(TRACK_MAIN, 'idle_1')
  }

  /** Простой с надписью free games. */
  idleFreeGames(): void {
    this.play(TRACK_MAIN, 'idle_2')
  }

  /** Обычная выигрышная анимация, затем возврат в простой scatter. */
  async win(signal?: AbortSignal): Promise<void> {
    await this.playOnce(TRACK_MAIN, 'win_1', signal)

    this.play(TRACK_MAIN, 'idle_1')
  }

  /** Переход во free games: отыгрывается один раз, дальше — `winFreeGamesLoop`. */
  winToFreeGames(signal?: AbortSignal): Promise<void> {
    return this.playOnce(TRACK_MAIN, 'win_2', signal)
  }

  /** Циклическая выигрышная анимация во free games. */
  winFreeGamesLoop(): void {
    this.play(TRACK_MAIN, 'win_3')
  }

  private applySize(): void {
    if (!this.spine || this.width === 0) return

    this.spine.scale.set(this.width / NATIVE_WIDTH)
    this.spine.position.set(this.width / 2, this.height / 2)
  }
}
