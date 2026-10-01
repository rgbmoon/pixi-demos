import { Assets, Sprite, type Texture } from 'pixi.js'

import { HUD_FRAMES } from '#src/assets'
import { ART_PIXEL, CABINET_FRONT_PLANE, RESET_BUTTON_SIZE_UNITS } from '#src/constants'
import type { ButtonOptions } from '#src/types'
import { ControlButton } from '#src/ui/hud/control-button'

/** Кнопка сброса кучи на плашке табло. */
export class ResetButton extends ControlButton {
  constructor(options: ButtonOptions) {
    const face = new Sprite(Assets.get<Texture>(HUD_FRAMES.reset.normal))

    face.scale.set(ART_PIXEL)
    super(options, CABINET_FRONT_PLANE, RESET_BUTTON_SIZE_UNITS, face, HUD_FRAMES.reset)
  }
}
