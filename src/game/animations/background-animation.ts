import { Assets, Container, Sprite, type Ticker } from 'pixi.js'
import { SceneBackground } from 'src/types/game'

import { BACKGROUND_ALIASES } from '../assets'
import type { GameTicker } from '../game-ticker'

const FADE_DURATION_MS = 200

/**
 * Фон сцены: светлый спрайт снизу, тёмный поверх; смена темы — fade alpha тёмного спрайта.
 */
export class BackgroundAnimation {
  readonly view = new Container()

  private readonly ticker: GameTicker
  private readonly lightSprite = new Sprite()
  private readonly darkSprite = new Sprite()
  private fadeStep?: (ticker: Ticker) => void
  private width = 0
  private height = 0

  constructor(ticker: GameTicker, initialBg: SceneBackground) {
    this.ticker = ticker

    this.darkSprite.alpha = initialBg === SceneBackground.light ? 0 : 1

    this.lightSprite.texture = Assets.get(BACKGROUND_ALIASES.light)
    this.darkSprite.texture = Assets.get(BACKGROUND_ALIASES.dark)

    this.view.addChild(this.lightSprite, this.darkSprite)
  }

  /** Растягивает фон на переданный размер экрана. */
  resize(width: number, height: number): void {
    this.width = width
    this.height = height

    this.applySize()
  }

  private applySize(): void {
    for (const sprite of [this.lightSprite, this.darkSprite]) {
      sprite.width = this.width
      sprite.height = this.height
    }
  }

  /** Плавно ведёт фон к целевой теме; вызов посреди fade разворачивает его с текущего alpha. */
  fadeTo(isAutospin: boolean): void {
    if (this.fadeStep) {
      this.ticker.remove(this.fadeStep)
      this.fadeStep = undefined
    }

    const target = Number(isAutospin)

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.darkSprite.alpha = target

      return
    }

    const direction = Math.sign(target - this.darkSprite.alpha)

    const step = (ticker: Ticker) => {
      if (this.view.destroyed) {
        this.ticker.remove(step)

        return
      }

      const next = this.darkSprite.alpha + (direction * ticker.deltaMS) / FADE_DURATION_MS

      // direction учитывает знак: условие означает «достигли или проскочили цель»
      if (direction * (next - target) >= 0) {
        this.darkSprite.alpha = target
        this.ticker.remove(step)
        this.fadeStep = undefined

        return
      }

      this.darkSprite.alpha = next
    }

    this.fadeStep = step
    this.ticker.add(step)
  }
}
