import { Text } from 'pixi.js'

import { FONT_FAMILY } from '#src/assets'
import type { LabelColor, LabelOptions } from '#src/types'
import { PALETTE } from '@pixi-demos/core/palette'

/** Текст сцены: шрифт из манифеста игры, цвет — из палитры по имени. */
export class Label extends Text {
  constructor(options: LabelOptions) {
    super({
      text: options.text ?? '',
      style: { fontFamily: FONT_FAMILY, fontSize: options.fontSize, fill: PALETTE[options.color] },
    })
  }

  /** Перекрашивает текст в цвет палитры по имени. */
  setColor(color: LabelColor): void {
    this.style.fill = PALETTE[color]
  }
}
