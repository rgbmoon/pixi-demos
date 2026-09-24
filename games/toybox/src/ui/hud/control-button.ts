import { Container, Graphics, Polygon } from 'pixi.js'

import { BUTTON_FILL_ALPHA, CONTROL_HIT_PADDING, DISABLED_ALPHA, LINE_THICKNESS } from '#src/constants'
import type { ButtonOptions, WorldPlane } from '#src/types'
import { getProjectedPlaneCircle } from '#src/utils/projection'
import { PALETTE } from '@pixi-demos/core/palette'

/** Круглая кнопка на плоскости корпуса: подложка, область нажатия и доступность. Иконку добавляет наследник. */
export class ControlButton extends Container {
  constructor(options: ButtonOptions, plane: WorldPlane, size: number) {
    super()

    const radius = size / 2
    const backing = new Graphics()
      .poly(getProjectedPlaneCircle(plane, radius))
      .fill({ color: PALETTE.primary, alpha: BUTTON_FILL_ALPHA })
      .stroke({ width: LINE_THICKNESS, color: PALETTE.primary })

    this.addChild(backing)

    this.eventMode = 'static'
    this.cursor = 'pointer'
    this.hitArea = new Polygon(getProjectedPlaneCircle(plane, radius + CONTROL_HIT_PADDING))
    this.accessible = true
    this.accessibleType = 'button'
    this.accessibleHint = options.label
    this.accessiblePointerEvents = 'none'

    this.on('pointertap', options.onTap)
  }

  /** Включает или гасит кнопку: интерактивность, курсор, прозрачность и доступность. */
  setEnabled(enabled: boolean): void {
    this.eventMode = enabled ? 'static' : 'none'
    this.cursor = enabled ? 'pointer' : 'default'
    this.alpha = enabled ? 1 : DISABLED_ALPHA
    this.accessible = enabled
  }
}
