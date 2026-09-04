import { Assets, Container, Sprite, type Ticker } from 'pixi.js'

import { BACKGROUND_ALIASES } from '../assets'
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../constants'
import type { GameTicker } from '../game-ticker'

const FADE_DURATION_MS = 200

/**
 * Фон сцены: обычный спрайт снизу, фриспиновый поверх; смена режима — fade alpha верхнего.
 * Арт нарисован в размер макета, поэтому вписывать его в канвас не нужно.
 */
export class BackgroundAnimation {
  readonly view = new Container()

  private readonly ticker: GameTicker
  private readonly defaultSprite = new Sprite()
  private readonly fsSprite = new Sprite()
  private fadeStep?: (ticker: Ticker) => void

  constructor(ticker: GameTicker, isFs: boolean) {
    this.ticker = ticker

    this.defaultSprite.texture = Assets.get(BACKGROUND_ALIASES.default)
    this.fsSprite.texture = Assets.get(BACKGROUND_ALIASES.fs)
    this.fsSprite.alpha = Number(isFs)

    for (const sprite of [this.defaultSprite, this.fsSprite]) {
      sprite.setSize(DESIGN_WIDTH, DESIGN_HEIGHT)
    }

    this.view.addChild(this.defaultSprite, this.fsSprite)
  }

  /** Плавно ведёт фон к целевому варианту; вызов посреди fade разворачивает его с текущего alpha. */
  fadeTo(isFs: boolean): void {
    if (this.fadeStep) {
      this.ticker.remove(this.fadeStep)
      this.fadeStep = undefined
    }

    const target = Number(isFs)

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.fsSprite.alpha = target

      return
    }

    const direction = Math.sign(target - this.fsSprite.alpha)

    const step = (ticker: Ticker) => {
      if (this.view.destroyed) {
        this.ticker.remove(step)

        return
      }

      const next = this.fsSprite.alpha + (direction * ticker.deltaMS) / FADE_DURATION_MS

      // direction учитывает знак: условие означает «достигли или проскочили цель»
      if (direction * (next - target) >= 0) {
        this.fsSprite.alpha = target
        this.ticker.remove(step)
        this.fadeStep = undefined

        return
      }

      this.fsSprite.alpha = next
    }

    this.fadeStep = step
    this.ticker.add(step)
  }
}
