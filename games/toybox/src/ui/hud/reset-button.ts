import { HUD_FRAMES } from '#src/assets'
import { CABINET_FRONT_PLANE, RESET_BUTTON_SIZE_UNITS } from '#src/constants'
import type { ButtonOptions } from '#src/types'
import { ControlButton } from '#src/ui/hud/control-button'

/** Кнопка сброса кучи на плашке табло. */
export class ResetButton extends ControlButton {
  constructor(options: ButtonOptions) {
    super(options, CABINET_FRONT_PLANE, RESET_BUTTON_SIZE_UNITS, HUD_FRAMES.reset)
  }
}
