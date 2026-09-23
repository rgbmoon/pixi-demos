import { Container, Graphics, Polygon } from 'pixi.js'

import {
  BUTTON_FILL_ALPHA,
  BUTTON_SIZE_UNITS,
  BUTTON_THICKNESS,
  CONTROL_HIT_PADDING,
  DISABLED_ALPHA,
  ICON_RATIO,
} from '#src/constants'
import type { ButtonOptions } from '#src/types'
import {
  CONTROL_PANEL_PLANE,
  getProjectedPlaneCircle,
  projectPlaneOffset,
} from '#src/utils/machine-geometry'
import { PALETTE } from '@pixi-demos/core/palette'

/** Кнопка опускания клешни, спроецированная в плоскость панели управления. */
export class DropButton extends Container {

  constructor(options: ButtonOptions) {
    super()

    const radius = BUTTON_SIZE_UNITS / 2
    const backing = new Graphics()
      .poly(getProjectedPlaneCircle(CONTROL_PANEL_PLANE, radius))
      .fill({ color: PALETTE.primary, alpha: BUTTON_FILL_ALPHA })
      .stroke({ width: BUTTON_THICKNESS, color: PALETTE.primary })

    this.addChild(backing, this.createIcon())

    this.eventMode = 'static'
    this.cursor = 'pointer'
    this.hitArea = new Polygon(getProjectedPlaneCircle(CONTROL_PANEL_PLANE, radius + CONTROL_HIT_PADDING))
    this.accessible = true
    this.accessibleType = 'button'
    this.accessibleHint = options.label
    this.accessiblePointerEvents = 'none'

    this.on('pointertap', options.onTap)
  }

  /** Включает или гасит кнопку. */
  setEnabled(enabled: boolean): void {
    this.eventMode = enabled ? 'static' : 'none'
    this.cursor = enabled ? 'pointer' : 'default'
    this.alpha = enabled ? 1 : DISABLED_ALPHA
    this.accessible = enabled
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
