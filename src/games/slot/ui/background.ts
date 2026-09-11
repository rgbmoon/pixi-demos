import { Assets, Container, Sprite, type Ticker } from 'pixi.js'
import type { GameTicker } from 'src/engine/game-ticker'

import { BACKGROUND_ALIASES } from '../assets'
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../constants'

const FADE_DURATION_MS = 200

/**
 * Фон сцены: обычный спрайт снизу, турбо поверх; смена режима — fade alpha верхнего.
 * Оба спрайта имеют размер макета; масштаб под размер канваса задаёт сцена.
 */
export class Background extends Container {
  private readonly ticker: GameTicker
  private readonly defaultSprite = new Sprite()
  private readonly turboSprite = new Sprite()
  private fadeStep?: (ticker: Ticker) => void

  constructor(ticker: GameTicker, isTurbo: boolean) {
    super()

    this.ticker = ticker

    this.defaultSprite.texture = Assets.get(BACKGROUND_ALIASES.default)
    this.turboSprite.texture = Assets.get(BACKGROUND_ALIASES.turbo)
    this.turboSprite.alpha = Number(isTurbo)

    for (const sprite of [this.defaultSprite, this.turboSprite]) {
      sprite.setSize(DESIGN_WIDTH, DESIGN_HEIGHT)
    }

    this.addChild(this.defaultSprite, this.turboSprite)
  }

  /** Плавно ведёт фон к целевому варианту; вызов посреди fade разворачивает его с текущего alpha. */
  fadeTo(isTurbo: boolean): void {
    if (this.fadeStep) {
      this.ticker.remove(this.fadeStep)
      this.fadeStep = undefined
    }

    const target = Number(isTurbo)

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.turboSprite.alpha = target

      return
    }

    const direction = Math.sign(target - this.turboSprite.alpha)

    const step = (ticker: Ticker) => {
      if (this.destroyed) {
        this.ticker.remove(step)

        return
      }

      const next = this.turboSprite.alpha + (direction * ticker.deltaMS) / FADE_DURATION_MS

      // direction учитывает знак: условие означает «достигли или проскочили цель»
      if (direction * (next - target) >= 0) {
        this.turboSprite.alpha = target
        this.ticker.remove(step)
        this.fadeStep = undefined

        return
      }

      this.turboSprite.alpha = next
    }

    this.fadeStep = step
    this.ticker.add(step)
  }
}
