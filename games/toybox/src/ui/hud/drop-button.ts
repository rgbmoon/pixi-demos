import { HUD_FRAMES } from '#src/assets'
import { BUTTON_SIZE_UNITS, CONTROL_PANEL_PLANE } from '#src/constants'
import type { ButtonOptions } from '#src/types'
import { ControlButton } from '#src/ui/hud/control-button'

/** Кнопка опускания клешни на панели управления: наклон панели заложен в рисунок кнопки. */
export class DropButton extends ControlButton {
  constructor(options: ButtonOptions) {
    super(options, CONTROL_PANEL_PLANE, BUTTON_SIZE_UNITS, HUD_FRAMES.drop)
  }
}
