import { Circle, Container, type FederatedPointerEvent, Graphics } from 'pixi.js'

import {
  CELL_SIZE,
  DISABLED_ALPHA,
  JOYSTICK_FILL_ALPHA,
  JOYSTICK_HIT_RADIUS,
  JOYSTICK_KNOB_RADIUS,
  JOYSTICK_RADIUS,
  JOYSTICK_STEM_THICKNESS,
  JOYSTICK_THICKNESS,
} from '#src/constants'
import type { JoystickOptions, ScreenPoint } from '#src/types'
import {
  CONTROL_PANEL_PLANE,
  getProjectedPlaneCircle,
  projectPlaneOffset,
  screenToPlaneOffset,
} from '#src/utils/machine-geometry'
import { worldToScreen } from '#src/utils/projection'
import { PALETTE } from '@pixi-demos/core/palette'

/** Джойстик, основание и ход ручки которого лежат в мировой плоскости панели управления. */
export class Joystick extends Container {
  readonly radiusUnits = JOYSTICK_RADIUS

  private readonly knob = new Graphics()
  private readonly onMove: (vector: ScreenPoint) => void
  private isDragging = false

  constructor(options: JoystickOptions) {
    super()

    this.onMove = options.onMove

    const base = new Graphics()
      .poly(getProjectedPlaneCircle(CONTROL_PANEL_PLANE, JOYSTICK_RADIUS))
      .fill({ color: PALETTE.primary, alpha: JOYSTICK_FILL_ALPHA })
      .stroke({ width: JOYSTICK_THICKNESS, color: PALETTE.primary })
    const top = worldToScreen({ x: 0, y: 0, z: JOYSTICK_KNOB_RADIUS / CELL_SIZE })
    const head = getProjectedPlaneCircle(CONTROL_PANEL_PLANE, JOYSTICK_KNOB_RADIUS).map(({ x, y }) => ({
      x: x + top.x,
      y: y + top.y,
    }))

    this.knob
      .moveTo(0, 0)
      .lineTo(top.x, top.y)
      .stroke({ width: JOYSTICK_STEM_THICKNESS, color: PALETTE.primary })
      .poly(head)
      .fill(PALETTE.primary)

    this.addChild(base, this.knob)

    this.eventMode = 'static'
    this.cursor = 'pointer'
    this.hitArea = new Circle(0, 0, JOYSTICK_HIT_RADIUS)
    this.accessiblePointerEvents = 'none'

    this.on('pointerdown', this.handleDown)
    this.on('globalpointermove', this.handleMove)
    this.on('pointerup', this.handleUp)
    this.on('pointerupoutside', this.handleUp)
  }

  /** Включает или гасит джойстик; выключенный отпускает ручку. */
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

  /** Ограничивает жест окружностью в плоскости панели и возвращает его экранное направление. */
  private apply(event: FederatedPointerEvent): void {
    const local = event.getLocalPosition(this)
    const plane = screenToPlaneOffset(CONTROL_PANEL_PLANE, local)
    const distance = Math.hypot(plane.x, plane.y)

    if (distance === 0) {
      this.knob.position.set(0, 0)
      this.onMove({ x: 0, y: 0 })

      return
    }

    const strength = Math.min(distance, JOYSTICK_RADIUS) / JOYSTICK_RADIUS
    const scale = (strength * JOYSTICK_RADIUS) / distance
    const offset = projectPlaneOffset(CONTROL_PANEL_PLANE, plane.x * scale, plane.y * scale)
    const screenDistance = Math.hypot(offset.x, offset.y)

    this.knob.position.set(offset.x, offset.y)
    this.onMove({ x: (offset.x / screenDistance) * strength, y: (offset.y / screenDistance) * strength })
  }
}
