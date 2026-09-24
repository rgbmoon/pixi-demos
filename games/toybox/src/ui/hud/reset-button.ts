import { Graphics } from 'pixi.js'

import {
  CABINET_FRONT_PLANE,
  ICON_RATIO,
  LINE_THICKNESS,
  RESET_ARC_END,
  RESET_ARC_START,
  RESET_BUTTON_SIZE_UNITS,
  RESET_HEAD_RATIO,
} from '#src/constants'
import type { ButtonOptions } from '#src/types'
import { ControlButton } from '#src/ui/hud/control-button'
import { getProjectedPlaneArc, projectPlaneOffset } from '#src/utils/projection'
import { PALETTE } from '@pixi-demos/core/palette'

/** Кнопка сброса кучи */
export class ResetButton extends ControlButton {
  constructor(options: ButtonOptions) {
    super(options, CABINET_FRONT_PLANE, RESET_BUTTON_SIZE_UNITS)

    this.addChild(ResetButton.createIcon())
  }

  private static createIcon(): Graphics {
    const radius = (RESET_BUTTON_SIZE_UNITS * ICON_RATIO) / 2
    const head = radius * RESET_HEAD_RATIO
    const arc = getProjectedPlaneArc(CABINET_FRONT_PLANE, radius, RESET_ARC_START, RESET_ARC_END)
    const icon = new Graphics().moveTo(arc[0].x, arc[0].y)

    for (const point of arc.slice(1)) icon.lineTo(point.x, point.y)

    icon.stroke({ width: LINE_THICKNESS, color: PALETTE.white })

    const tip = { x: Math.cos(RESET_ARC_START) * radius, y: Math.sin(RESET_ARC_START) * radius }

    return icon
      .poly([
        projectPlaneOffset(CABINET_FRONT_PLANE, tip.x + head, tip.y),
        projectPlaneOffset(CABINET_FRONT_PLANE, tip.x - head, tip.y - head),
        projectPlaneOffset(CABINET_FRONT_PLANE, tip.x - head, tip.y + head),
      ])
      .fill({ color: PALETTE.white })
  }
}
