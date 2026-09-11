import { Assets, Container, Graphics, Sprite, type Ticker } from 'pixi.js'
import type { GameTicker } from 'src/engine/game-ticker'
import { tweenAlpha } from 'src/engine/utils'

import { BACKGROUND_ALIASES } from '../assets'
import {
  ANTICIPATION_FLASH_ALPHA,
  ANTICIPATION_FLASH_COUNT,
  ANTICIPATION_FLASH_MS,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
} from '../constants'

const FADE_DURATION_MS = 200

/**
 * Фон сцены: обычный спрайт снизу, турбо поверх; смена режима — fade alpha верхнего.
 * Над ними белый слой вспышки. Всё размером макета; масштаб под размер канваса задаёт сцена.
 */
export class Background extends Container {
  private readonly ticker: GameTicker
  private readonly defaultSprite = new Sprite()
  private readonly turboSprite = new Sprite()
  private readonly flashLayer = new Graphics()
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

    // Сложение осветляет картинку под слоем, а не заливает её белым
    this.flashLayer.rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT).fill(0xffffff)
    this.flashLayer.blendMode = 'add'
    this.flashLayer.alpha = 0

    this.addChild(this.defaultSprite, this.turboSprite, this.flashLayer)
  }

  /** Моргает фоном `ANTICIPATION_FLASH_COUNT` раз; при `prefers-reduced-motion` вспышек нет. */
  async flash(signal?: AbortSignal): Promise<void> {
    try {
      for (let index = 0; index < ANTICIPATION_FLASH_COUNT; index += 1) {
        await tweenAlpha(this.ticker, this.flashLayer, ANTICIPATION_FLASH_ALPHA, ANTICIPATION_FLASH_MS, signal)
        await tweenAlpha(this.ticker, this.flashLayer, 0, ANTICIPATION_FLASH_MS, signal)
      }
    } finally {
      this.flashLayer.alpha = 0
    }
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
