import { Assets, Sprite, type Texture } from 'pixi.js'

import { HUD_FRAMES } from '#src/assets'
import { ART_PIXEL, BUTTON_SIZE_UNITS, CONTROL_PANEL_PLANE } from '#src/constants'
import type { ButtonOptions } from '#src/types'
import { ControlButton } from '#src/ui/hud/control-button'

/** Кнопка опускания клешни на панели управления: наклон панели заложен в рисунок кнопки. */
export class DropButton extends ControlButton {
  constructor(options: ButtonOptions) {
    const face = new Sprite(Assets.get<Texture>(HUD_FRAMES.drop.normal))

    face.scale.set(ART_PIXEL)
    super(options, CONTROL_PANEL_PLANE, BUTTON_SIZE_UNITS, face, HUD_FRAMES.drop)
  }
}
