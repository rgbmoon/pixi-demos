import { Assets, Container, Graphics, Sprite, type Texture, type Ticker } from 'pixi.js'
import { BG_CANVAS_COLOR } from 'src/constants/bg-blobs'

import type { GameTicker } from '../game-ticker'

const LOGO_SOURCE = '/src/assets/game/graphic/AL_Logo/AL_Logo.png'

const APPEAR_DURATION_MS = 400
const FADE_DURATION_MS = 350

/** Доля ширины экрана и потолок в пикселях для ширины лого */
const LOGO_WIDTH_RATIO = 0.6
const LOGO_MAX_WIDTH = 480

/** С какого масштаба лого начинает рост при появлении */
const APPEAR_FROM = 0.7

const easeOut = (progress: number): number => 1 - (1 - progress) ** 3

const isReducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Экран загрузки: заливка фона и лого по центру.
 * `appear` растит лого масштабом, `hide` растворяет экран и резолвится в конце fade.
 */
export class LoadingScreenAnimation {
  readonly view = new Container()

  private readonly ticker: GameTicker
  private readonly backdrop = new Graphics()
  private readonly logo = new Sprite()
  private step?: (ticker: Ticker) => void
  private appearPending = false
  private baseScale = 1
  private width = 0
  private height = 0

  constructor(ticker: GameTicker) {
    this.ticker = ticker

    this.logo.anchor.set(0.5)
    this.view.addChild(this.backdrop, this.logo)

    void this.load()
  }

  private async load(): Promise<void> {
    const texture = await Assets.load<Texture>(LOGO_SOURCE)

    if (this.view.destroyed) return

    this.logo.texture = texture

    // baseScale считается от размера текстуры, до её загрузки он неизвестен
    this.applySize()

    // appear обычно приходит раньше текстуры — тогда рост лого начинается отсюда
    if (this.appearPending) {
      this.appear()
    }
  }

  /** Растягивает фон на размер экрана и пересчитывает масштаб лого. */
  resize(width: number, height: number): void {
    this.width = width
    this.height = height

    this.applySize()
  }

  private applySize(): void {
    this.backdrop.clear().rect(0, 0, this.width, this.height).fill(BG_CANVAS_COLOR)

    this.logo.position.set(this.width / 2, this.height / 2)

    if (this.logo.texture.width === 0) return

    this.baseScale = Math.min(this.width * LOGO_WIDTH_RATIO, LOGO_MAX_WIDTH) / this.logo.texture.width

    // масштаб посреди появления не сбрасываем — шаг допишет его сам
    if (!this.step) {
      this.logo.scale.set(this.baseScale)
    }
  }

  /** Возвращает экран в непрозрачное состояние и растит лого от APPEAR_FROM до полного размера. */
  appear(): void {
    this.stop()

    this.view.alpha = 1
    this.appearPending = this.logo.texture.width === 0

    if (this.appearPending || isReducedMotion()) {
      this.logo.scale.set(this.baseScale)

      return
    }

    let elapsed = 0

    this.run((ticker) => {
      elapsed += ticker.deltaMS

      const progress = Math.min(elapsed / APPEAR_DURATION_MS, 1)
      const factor = APPEAR_FROM + (1 - APPEAR_FROM) * easeOut(progress)

      this.logo.scale.set(this.baseScale * factor)

      if (progress === 1) {
        this.stop()
      }
    })
  }

  /** Растворяет экран; промис резолвится в конце fade. Прерванный новым `appear` — не резолвится. */
  hide(): Promise<void> {
    this.stop()

    this.appearPending = false

    if (isReducedMotion()) {
      this.view.alpha = 0

      return Promise.resolve()
    }

    return new Promise<void>((resolve) => {
      let elapsed = 0

      this.run((ticker) => {
        elapsed += ticker.deltaMS

        const progress = Math.min(elapsed / FADE_DURATION_MS, 1)

        this.view.alpha = 1 - progress

        if (progress === 1) {
          this.stop()
          resolve()
        }
      })
    })
  }

  private run(step: (ticker: Ticker) => void): void {
    const guarded = (ticker: Ticker) => {
      if (this.view.destroyed) {
        this.stop()

        return
      }

      step(ticker)
    }

    this.step = guarded
    this.ticker.add(guarded)
  }

  private stop(): void {
    if (!this.step) return

    this.ticker.remove(this.step)
    this.step = undefined
  }
}
