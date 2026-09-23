import { Container, Graphics, Polygon } from 'pixi.js'

import {
  BUTTON_FILL_ALPHA,
  BUTTON_THICKNESS,
  CONTROL_HIT_PADDING,
  DISABLED_ALPHA,
  ICON_RATIO,
  RESET_ARC_END,
  RESET_ARC_START,
  RESET_BUTTON_SIZE_UNITS,
  RESET_HEAD_RATIO,
} from '#src/constants'
import type { ButtonOptions } from '#src/types'
import {
  CABINET_FRONT_PLANE,
  getProjectedPlaneArc,
  getProjectedPlaneCircle,
  projectPlaneOffset,
} from '#src/utils/machine-geometry'
import { PALETTE } from '@pixi-demos/core/palette'

/** Кнопка сброса, установленная на передней вертикальной грани тумбы. */
export class ResetButton extends Container {

  constructor(options: ButtonOptions) {
    super()

    const radius = RESET_BUTTON_SIZE_UNITS / 2
    const backing = new Graphics()
      .poly(getProjectedPlaneCircle(CABINET_FRONT_PLANE, radius))
      .fill({ color: PALETTE.primary, alpha: BUTTON_FILL_ALPHA })
      .stroke({ width: BUTTON_THICKNESS, color: PALETTE.primary })

    this.addChild(backing, ResetButton.createIcon())

    this.eventMode = 'static'
    this.cursor = 'pointer'
    this.hitArea = new Polygon(getProjectedPlaneCircle(CABINET_FRONT_PLANE, radius + CONTROL_HIT_PADDING))
    this.accessible = true
    this.accessibleType = 'button'
    this.accessibleHint = options.label
    this.accessiblePointerEvents = 'none'

    this.on('pointertap', options.onTap)
  }

  /** Меняет интерактивность, прозрачность и доступность кнопки. */
  setEnabled(enabled: boolean): void {
    this.eventMode = enabled ? 'static' : 'none'
    this.cursor = enabled ? 'pointer' : 'default'
    this.alpha = enabled ? 1 : DISABLED_ALPHA
    this.accessible = enabled
  }

  private static createIcon(): Graphics {
    const radius = (RESET_BUTTON_SIZE_UNITS * ICON_RATIO) / 2
    const head = radius * RESET_HEAD_RATIO
    const arc = getProjectedPlaneArc(CABINET_FRONT_PLANE, radius, RESET_ARC_START, RESET_ARC_END)
    const icon = new Graphics().moveTo(arc[0].x, arc[0].y)

    for (const point of arc.slice(1)) icon.lineTo(point.x, point.y)

    icon.stroke({ width: BUTTON_THICKNESS, color: PALETTE.white })

    const tip = { x: Math.cos(RESET_ARC_START) * radius, y: Math.sin(RESET_ARC_START) * radius }

    return icon
      .poly([
        projectPlaneOffset(CABINET_FRONT_PLANE, tip.x + head, tip.y, true),
        projectPlaneOffset(CABINET_FRONT_PLANE, tip.x - head, tip.y - head, true),
        projectPlaneOffset(CABINET_FRONT_PLANE, tip.x - head, tip.y + head, true),
      ])
      .fill({ color: PALETTE.white })
  }
}
