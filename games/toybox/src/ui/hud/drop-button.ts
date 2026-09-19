import { Circle, Container, Graphics } from 'pixi.js'

import { BUTTON_FILL_ALPHA, BUTTON_SIZE_UNITS, BUTTON_THICKNESS, DISABLED_ALPHA, ICON_RATIO } from '#src/constants'
import type { ButtonOptions } from '#src/types'
import { PALETTE } from '@pixi-demos/core/palette'

/**
 * Кнопка опускания клешни: круглая подложка с двойным шевроном вниз. Своего арта у игры пока нет,
 * поэтому всё рисуется `Graphics`; центр кнопки — её начало координат.
 */
export class DropButton extends Container {
  /** Сторона кнопки в дизайн-единицах: по ней сцена считает габариты блока управления. */
  readonly sizeUnits = BUTTON_SIZE_UNITS

  constructor(options: ButtonOptions) {
    super()

    const radius = BUTTON_SIZE_UNITS / 2
    const backing = new Graphics()
      .circle(0, 0, radius)
      .fill({ color: PALETTE.primary, alpha: BUTTON_FILL_ALPHA })
      .stroke({ width: BUTTON_THICKNESS, color: PALETTE.primary })

    this.addChild(backing, this.createIcon())

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

  /** Включает или гасит кнопку: снимает интерактивность и притеняет подложку. */
  setEnabled(enabled: boolean): void {
    this.eventMode = enabled ? 'static' : 'none'
    this.cursor = enabled ? 'pointer' : 'default'
    this.alpha = enabled ? 1 : DISABLED_ALPHA
    // Недоступность кнопки должна быть видна и снаружи канваса
    this.accessible = enabled
  }

  private createIcon(): Graphics {
    const size = (BUTTON_SIZE_UNITS * ICON_RATIO) / 2
    const icon = new Graphics()

    for (const offset of [-size * 0.7, size * 0.3]) {
      icon.poly([0, offset + size * 0.7, -size * 0.8, offset - size * 0.2, size * 0.8, offset - size * 0.2])
    }

    return icon.fill({ color: PALETTE.white })
  }
}
