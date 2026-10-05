import { type Texture, TilingSprite } from 'pixi.js'

import type { ScreenRect } from '#src/types'
import { FrameAnimation } from '@pixi-demos/engine/frame-animation'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'

/**
 * Полоса фона из бесшовного тайла в пикселях арта: рисунок привязан к сетке арта и при ресайзе не сдвигается.
 * Кадры тайла можно проигрывать: смена кадра меняет текстуру всей полосы.
 */
export class TiledBand extends FrameAnimation<TilingSprite> {
  /** Положение рисунка, при котором левый столбец тайла лежит на x = 0 и верхняя строка — на высоте начала рисунка. */
  private readonly tileOrigin = { x: 0, y: 0 }
  /** Сдвиг рисунка вправо в пикселях арта, в пределах ширины тайла. */
  private scroll = 0

  constructor(ticker: GameTicker, texture: Texture) {
    super(ticker, new TilingSprite({ texture }))
  }

  /** Высота тайла в пикселях арта. */
  get tileHeight(): number {
    return this.carrier.texture.height
  }

  /** Закрывает прямоугольник `band`; верхняя строка тайла лежит на высоте `originY`, левый столбец — на x = 0. */
  cover({ left, top, right, bottom }: ScreenRect, originY: number): void {
    this.visible = right > left && bottom > top

    if (!this.visible) return

    this.carrier.position.set(left, top)
    this.carrier.setSize(right - left, bottom - top)
    this.tileOrigin.x = -left
    this.tileOrigin.y = originY - top
    this.applyTiling()
  }

  /** Сдвигает рисунок вправо на целое число пикселей арта. */
  protected scrollBy(pixels: number): void {
    this.scroll = (this.scroll + pixels) % this.carrier.texture.width
    this.applyTiling()
  }

  private applyTiling(): void {
    this.carrier.tilePosition.set(this.tileOrigin.x + this.scroll, this.tileOrigin.y)
  }
}
