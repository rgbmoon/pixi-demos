import { Assets, Container, Sprite, type Texture, type Ticker } from 'pixi.js'
import { SceneBackground } from 'src/types/game'

import type { GameTicker } from '../game-ticker'

const FADE_DURATION_MS = 200

const TEXTURE_SOURCES = {
  [SceneBackground.light]: { alias: 'al_bg_reg', src: '/src/assets/game/graphic/AL_Background/AL_bg_reg.{webp,png}' },
  [SceneBackground.dark]: { alias: 'al_bg_fs', src: '/src/assets/game/graphic/AL_Background/AL_bg_fs.{webp,png}' },
} as const

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
    this.view.addChild(this.lightSprite, this.darkSprite)

    void this.load()
  }

  private async load(): Promise<void> {
    const [light, dark] = await Promise.all([
      Assets.load<Texture>(TEXTURE_SOURCES.light),
      Assets.load<Texture>(TEXTURE_SOURCES.dark),
    ])

    if (this.view.destroyed) return

    this.lightSprite.texture = light
    this.darkSprite.texture = dark

    // width/height спрайта — производные scale от текстуры, после её смены размер выставляется заново
    this.applySize()
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
