import { Container, type DestroyOptions, type Ticker, UPDATE_PRIORITY } from 'pixi.js'
import type { GameTicker } from 'src/game/game-ticker'
import type { SkeletonLike } from 'src/game/types'

import { StubAnimationState } from './stub-animation-state'
import { StubSkeleton } from './stub-skeleton'
import type { StubSkeletonData } from './types'

/**
 * Спрайтовый скелет вместо `Spine`: контейнер со слотами, треками и тем же жизненным циклом.
 * Позу собирает из данных, поэтому новая анимация — новая запись в базе мока, а не новый код.
 */
export class StubSpine extends Container implements SkeletonLike {
  readonly skeleton: StubSkeleton
  readonly state: StubAnimationState

  private readonly ticker: GameTicker
  private ticking = false

  constructor(data: StubSkeletonData, ticker: GameTicker) {
    super()

    this.ticker = ticker
    this.skeleton = new StubSkeleton(data)
    this.state = new StubAnimationState(data.animations)

    this.addChild(...this.skeleton.slots)
  }

  get autoUpdate(): boolean {
    return this.ticking
  }

  set autoUpdate(value: boolean) {
    if (value === this.ticking) return

    this.ticking = value

    // Приоритет тот же, что у Spine: поза считается до отрисовки кадра
    if (value) this.ticker.add(this.onTick, this, UPDATE_PRIORITY.HIGH)
    else this.ticker.remove(this.onTick, this)
  }

  /** Двигает треки и пересобирает позу: setup-поза, поверх неё клипы активных треков. */
  update(deltaSeconds: number): void {
    this.state.update(deltaSeconds)
    this.skeleton.setToSetupPose()
    this.state.apply(this.skeleton)
  }

  /** Слот-объектов у стаба нет: метод существует ради совместимости со `Spine`. */
  removeSlotObjects(): void {}

  override destroy(options?: DestroyOptions): void {
    // Тикер переживает скелет: без снятия колбэка он тикал бы уничтоженный контейнер
    this.autoUpdate = false

    super.destroy(options ?? { children: true })
  }

  // Стабильная ссылка: иначе колбэк не снять с тикера
  private readonly onTick = (ticker: Ticker): void => {
    this.update(ticker.deltaMS / 1000)
  }
}
