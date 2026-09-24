import { Graphics } from 'pixi.js'

import { BUTTON_SIZE_UNITS, CONTROL_PANEL_PLANE, ICON_RATIO } from '#src/constants'
import type { ButtonOptions } from '#src/types'
import { ControlButton } from '#src/ui/hud/control-button'
import { projectPlaneOffset } from '#src/utils/projection'
import { PALETTE } from '@pixi-demos/core/palette'

/** Кнопка опускания клешни, спроецированная в плоскость панели управления. */
export class DropButton extends ControlButton {
  constructor(options: ButtonOptions) {
    super(options, CONTROL_PANEL_PLANE, BUTTON_SIZE_UNITS)

    this.addChild(this.createIcon())
  }

  private createIcon(): Graphics {
    const size = (BUTTON_SIZE_UNITS * ICON_RATIO) / 2
    const icon = new Graphics()

    for (const offset of [-size * 0.7, size * 0.3]) {
      icon.poly([
        projectPlaneOffset(CONTROL_PANEL_PLANE, 0, offset + size * 0.7),
        projectPlaneOffset(CONTROL_PANEL_PLANE, -size * 0.8, offset - size * 0.2),
        projectPlaneOffset(CONTROL_PANEL_PLANE, size * 0.8, offset - size * 0.2),
      ])
    }

    return icon.fill({ color: PALETTE.white })
  }
}
