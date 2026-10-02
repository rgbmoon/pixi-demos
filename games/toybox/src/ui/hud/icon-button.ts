import { BitmapText, Container, Rectangle } from 'pixi.js'

import { FONT_FAMILIES } from '#src/assets'
import { PIXEL_FONT_SIZE } from '#src/constants'
import type { ButtonOptions } from '#src/types'

/** Кнопка-иконка в облаке диалога: глиф пиксельного шрифта, нажатая кнопка опускается на пиксель арта. */
export class IconButton extends Container {
  private readonly glyph: BitmapText

  constructor(options: ButtonOptions, icon: string, hitPadding: number) {
    super()

    this.glyph = new BitmapText({ text: icon, style: { fontFamily: FONT_FAMILIES.dialog, fontSize: PIXEL_FONT_SIZE } })
    this.addChild(this.glyph)

    const { x, y, width, height } = this.glyph.getLocalBounds()

    this.eventMode = 'static'
    this.cursor = 'pointer'
    this.hitArea = new Rectangle(x - hitPadding, y - hitPadding, width + 2 * hitPadding, height + 2 * hitPadding)
    this.accessible = true
    this.accessibleType = 'button'
    this.accessibleHint = options.label
    this.accessiblePointerEvents = 'none'

    this.on('pointerdown', () => this.setPressed(true))
    this.on('pointerup', () => this.setPressed(false))
    this.on('pointerupoutside', () => this.setPressed(false))
    this.on('pointertap', options.onTap)
  }

  /** Показывает кнопку нажатой или отпущенной. */
  setPressed(pressed: boolean): void {
    this.glyph.y = pressed ? 1 : 0
  }
}
