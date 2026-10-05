import { Assets, Container, Matrix, type Texture, TilingSprite } from 'pixi.js'

import { CLAW_FRAMES } from '#src/assets'
import { ART_PIXEL } from '#src/constants'
import type { ScreenPoint } from '#src/types'

/**
 * Трос: вертикальный тайл, наклон при качании задаёт матрица сдвига строк. Рисунок привязан к нижнему концу и
 * движется вместе с клешнёй.
 */
export class Rope extends Container {
  private readonly cable = new TilingSprite({ texture: Assets.get<Texture>(CLAW_FRAMES.rope) })

  constructor() {
    super()

    this.addChild(this.cable)
  }

  /**
   * Тянет трос из точки `top` на `rows` пикселей арта вниз; `slope` — сдвиг по горизонтали на единицу высоты.
   * Средний столбец троса проходит через `top`.
   */
  setSpan(top: ScreenPoint, rows: number, slope: number): void {
    this.cable.visible = rows > 0
    if (!this.cable.visible) return

    const { width } = this.cable.texture

    this.cable.setSize(width, rows)
    this.cable.tilePosition.set(0, rows)
    this.cable.setFromMatrix(
      new Matrix(ART_PIXEL, 0, slope * ART_PIXEL, ART_PIXEL, top.x - (width / 2) * ART_PIXEL, top.y)
    )
  }
}
