import { Circle, Container, type FederatedPointerEvent, Graphics } from 'pixi.js'

import {
  CELL_SIZE,
  CONTROL_PANEL_PLANE,
  DISABLED_ALPHA,
  JOYSTICK_FILL_ALPHA,
  JOYSTICK_HIT_RADIUS,
  JOYSTICK_KNOB_RADIUS,
  JOYSTICK_RADIUS,
  JOYSTICK_STEM_THICKNESS,
  LINE_THICKNESS,
} from '#src/constants'
import type { JoystickOptions, ScreenPoint } from '#src/types'
import {
  getProjectedPlaneCircle,
  projectPlaneOffset,
  screenToPlaneOffset,
  worldToScreen,
} from '#src/utils/projection'
import { PALETTE } from '@pixi-demos/core/palette'

/** Джойстик, основание и ход ручки которого лежат в мировой плоскости панели управления. */
export class Joystick extends Container {
  private readonly stem = new Graphics()
  private readonly head = new Graphics()
  /** Центр головки в нейтральном положении: над центром основания на высоте её радиуса. */
  private readonly rest = worldToScreen({ x: 0, y: 0, z: JOYSTICK_KNOB_RADIUS / CELL_SIZE })
  private readonly onMove: (vector: ScreenPoint) => void
  private isDragging = false

  constructor(options: JoystickOptions) {
    super()

    this.onMove = options.onMove

    const base = new Graphics()
      .poly(getProjectedPlaneCircle(CONTROL_PANEL_PLANE, JOYSTICK_RADIUS))
      .fill({ color: PALETTE.primary, alpha: JOYSTICK_FILL_ALPHA })
      .stroke({ width: LINE_THICKNESS, color: PALETTE.primary })

    this.head.poly(getProjectedPlaneCircle(CONTROL_PANEL_PLANE, JOYSTICK_KNOB_RADIUS)).fill(PALETTE.primary)
    this.tilt({ x: 0, y: 0 })

    this.addChild(base, this.stem, this.head)

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
    this.tilt({ x: 0, y: 0 })
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
      this.tilt({ x: 0, y: 0 })
      this.onMove({ x: 0, y: 0 })

      return
    }

    const strength = Math.min(distance, JOYSTICK_RADIUS) / JOYSTICK_RADIUS
    const scale = (strength * JOYSTICK_RADIUS) / distance
    const offset = projectPlaneOffset(CONTROL_PANEL_PLANE, plane.x * scale, plane.y * scale)
    const screenDistance = Math.hypot(offset.x, offset.y)

    this.tilt(offset)
    this.onMove({ x: (offset.x / screenDistance) * strength, y: (offset.y / screenDistance) * strength })
  }

  /**
   * Сдвигает головку на экранное смещение `offset` и перерисовывает стойку от центра основания до головки.
   * Головка поднята над основанием, поэтому стойка нулевой длины не бывает.
   */
  private tilt(offset: ScreenPoint): void {
    const x = this.rest.x + offset.x
    const y = this.rest.y + offset.y

    this.head.position.set(x, y)
    this.stem.clear().moveTo(0, 0).lineTo(x, y).stroke({ width: JOYSTICK_STEM_THICKNESS, color: PALETTE.primary })
  }
}
