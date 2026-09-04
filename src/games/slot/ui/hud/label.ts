import { Text } from 'pixi.js'
import { PALETTE } from 'src/core/palette'
import { FONT_FAMILY } from 'src/games/slot/assets'
import type { LabelOptions } from 'src/games/slot/types'

/** Текст сцены: шрифт из манифеста игры, цвет — из палитры по имени. */
export class Label extends Text {
  constructor(options: LabelOptions) {
    super({
      text: options.text ?? '',
      style: { fontFamily: FONT_FAMILY, fontSize: options.fontSize, fill: PALETTE[options.color] },
    })
  }
}
