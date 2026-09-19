import { Circle, Container, type FederatedPointerEvent, Graphics } from 'pixi.js'

import {
  DISABLED_ALPHA,
  JOYSTICK_FILL_ALPHA,
  JOYSTICK_KNOB_RADIUS,
  JOYSTICK_RADIUS,
  JOYSTICK_THICKNESS,
} from '#src/constants'
import type { JoystickOptions, ScreenPoint } from '#src/types'
import { PALETTE } from '@pixi-demos/core/palette'

/**
 * Джойстик: подложка с ручкой, которую тянут указателем. Жест ведётся `globalpointermove`, поэтому
 * палец может уходить за подложку; отклонение отдаётся наружу вектором длиной от 0 до 1.
 */
export class Joystick extends Container {
  /** Радиус подложки в дизайн-единицах: по нему сцена считает габариты блока управления. */
  readonly radiusUnits = JOYSTICK_RADIUS

  private readonly knob = new Graphics()
  private readonly onMove: (vector: ScreenPoint) => void
  private isDragging = false

  constructor(options: JoystickOptions) {
    super()

    this.onMove = options.onMove

    const base = new Graphics()
      .circle(0, 0, JOYSTICK_RADIUS)
      .fill({ color: PALETTE.primary, alpha: JOYSTICK_FILL_ALPHA })
      .stroke({ width: JOYSTICK_THICKNESS, color: PALETTE.primary })

    this.knob.circle(0, 0, JOYSTICK_KNOB_RADIUS).fill({ color: PALETTE.primary })

    this.addChild(base, this.knob)

    this.eventMode = 'static'
    this.cursor = 'pointer'
    this.hitArea = new Circle(0, 0, JOYSTICK_RADIUS)
    // На тач-устройствах слой доступности не снимается, и его DOM-узел перехватил бы жест у канваса
    this.accessiblePointerEvents = 'none'

    this.on('pointerdown', this.handleDown)
    this.on('globalpointermove', this.handleMove)
    this.on('pointerup', this.handleUp)
    this.on('pointerupoutside', this.handleUp)
  }

  /** Включает или гасит джойстик; выключенный отпускает ручку, чтобы жест не повис. */
  setEnabled(enabled: boolean): void {
    if (!enabled) this.release()

    this.eventMode = enabled ? 'static' : 'none'
    this.cursor = enabled ? 'pointer' : 'default'
    this.alpha = enabled ? 1 : DISABLED_ALPHA
  }

  /** Возвращает ручку в центр и объявляет нулевое отклонение. */
  release(): void {
    if (!this.isDragging) return

    this.isDragging = false
    this.knob.position.set(0, 0)
    this.onMove({ x: 0, y: 0 })
  }

  private handleDown = (event: FederatedPointerEvent): void => {
    this.isDragging = true

    this.apply(event)
  }

  private handleMove = (event: FederatedPointerEvent): void => {
    if (this.isDragging) this.apply(event)
  }

  private handleUp = (): void => {
    this.release()
  }

  /** Считает отклонение от центра подложки: направление жеста и его доля от радиуса. */
  private apply(event: FederatedPointerEvent): void {
    const local = event.getLocalPosition(this)
    const distance = Math.hypot(local.x, local.y)

    if (distance === 0) {
      this.knob.position.set(0, 0)
      this.onMove({ x: 0, y: 0 })

      return
    }

    const strength = Math.min(distance, JOYSTICK_RADIUS) / JOYSTICK_RADIUS
    const vector = { x: (local.x / distance) * strength, y: (local.y / distance) * strength }

    this.knob.position.set(vector.x * JOYSTICK_RADIUS, vector.y * JOYSTICK_RADIUS)
    this.onMove(vector)
  }
}
