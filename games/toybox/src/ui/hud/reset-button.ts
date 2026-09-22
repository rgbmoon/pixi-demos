import { Circle, Container, Graphics } from 'pixi.js'

import {
  BUTTON_FILL_ALPHA,
  BUTTON_THICKNESS,
  DISABLED_ALPHA,
  ICON_RATIO,
  RESET_ARC_END,
  RESET_ARC_START,
  RESET_BUTTON_SIZE_UNITS,
  RESET_HEAD_RATIO,
} from '#src/constants'
import type { ButtonOptions } from '#src/types'
import { PALETTE } from '@pixi-demos/core/palette'

/**
 * Кнопка сброса кучи: круглая подложка с круговой стрелкой, меньше основной кнопки опускания.
 */
export class ResetButton extends Container {
  /** Сторона кнопки в дизайн-единицах: по ней сцена ставит её в угол экрана. */
  readonly sizeUnits = RESET_BUTTON_SIZE_UNITS

  constructor(options: ButtonOptions) {
    super()

    const radius = RESET_BUTTON_SIZE_UNITS / 2
    const backing = new Graphics()
      .circle(0, 0, radius)
      .fill({ color: PALETTE.primary, alpha: BUTTON_FILL_ALPHA })
      .stroke({ width: BUTTON_THICKNESS, color: PALETTE.primary })

    this.addChild(backing, ResetButton.createIcon())

    this.eventMode = 'static'
    this.cursor = 'pointer'
    this.hitArea = new Circle(0, 0, radius)

    // Слой доступности PIXI кладёт поверх канваса настоящий <button> с этим именем
    this.accessible = true
    this.accessibleType = 'button'
    this.accessibleHint = options.label
    // На тач-устройствах слой не снимается, и его DOM-кнопка перехватила бы pointerdown у канваса
    this.accessiblePointerEvents = 'none'

    this.on('pointertap', options.onTap)
  }

  /** Меняет интерактивность, прозрачность и доступность кнопки. */
  setEnabled(enabled: boolean): void {
    this.eventMode = enabled ? 'static' : 'none'
    this.cursor = enabled ? 'pointer' : 'default'
    this.alpha = enabled ? 1 : DISABLED_ALPHA
    // Недоступность кнопки должна быть видна и снаружи канваса
    this.accessible = enabled
  }

  private static createIcon(): Graphics {
    const radius = (RESET_BUTTON_SIZE_UNITS * ICON_RATIO) / 2
    const head = radius * RESET_HEAD_RATIO
    const tip = { x: Math.cos(RESET_ARC_START) * radius, y: Math.sin(RESET_ARC_START) * radius }

    return new Graphics()
      .arc(0, 0, radius, RESET_ARC_START, RESET_ARC_END)
      .stroke({ width: BUTTON_THICKNESS, color: PALETTE.white })
      .poly([tip.x + head, tip.y, tip.x - head, tip.y - head, tip.x - head, tip.y + head])
      .fill({ color: PALETTE.white })
  }
}
