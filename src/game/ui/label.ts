import { Text } from 'pixi.js'
import { PALETTE } from 'src/constants/palette'

import { FONT_FAMILY } from '../assets'

export const LabelColor = {
  gold: 'gold',
  white: 'white',
} as const

export type LabelColor = (typeof LabelColor)[keyof typeof LabelColor]

interface LabelOptions {
  color: LabelColor
  fontSize: number
  text?: string
}

export class Label extends Text {
  constructor(options: LabelOptions) {
    super({
      text: options.text ?? '',
      style: { fontFamily: FONT_FAMILY, fontSize: options.fontSize, fill: PALETTE[options.color] },
    })
  }
}
