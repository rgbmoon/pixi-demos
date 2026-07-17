import { Assets, Text } from 'pixi.js'
import { PALETTE } from 'src/constants/palette'

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

const FONT_SRC = '/src/assets/game/graphic/AL_Fonts/TiltWarp-Regular.ttf'
const FONT_FAMILY = 'Tilt Warp'

/** Текст сцены. */
export class Label extends Text {
  constructor(options: LabelOptions) {
    super({
      text: options.text ?? '',
      style: { fontFamily: 'sans-serif', fontSize: options.fontSize, fill: PALETTE[options.color] },
    })

    void this.loadFont()
  }

  private async loadFont(): Promise<void> {
    await Assets.load({ src: FONT_SRC, data: { family: FONT_FAMILY } })

    if (this.destroyed) return

    this.style.fontFamily = FONT_FAMILY
  }
}
