import { Text } from 'pixi.js'

import { COUNTER_FONT_SIZE, HUD_FONT_FAMILY } from '#src/constants'
import { PALETTE } from '@pixi-demos/core/palette'

const CAPTION = 'TOYS'

/** Счётчик доставленных игрушек: строка «подпись + значение» с началом в левом верхнем углу. */
export class Counter extends Text {
  constructor() {
    super({
      text: `${CAPTION} 0`,
      style: { fontFamily: HUD_FONT_FAMILY, fontSize: COUNTER_FONT_SIZE, fill: PALETTE.white },
    })
  }

  setValue(value: number): void {
    this.text = `${CAPTION} ${value}`
  }
}
