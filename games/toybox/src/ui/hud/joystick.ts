import {
  Assets,
  Circle,
  Container,
  type FederatedPointerEvent,
  Matrix,
  Sprite,
  type Texture,
  TilingSprite,
} from 'pixi.js'

import { HUD_FRAMES } from '#src/assets'
import {
  ART_PIXEL,
  CONTROL_PANEL_PLANE,
  DISABLED_TINT,
  JOYSTICK_BOOT_HEIGHT,
  JOYSTICK_HIT_RADIUS,
  JOYSTICK_RADIUS,
  JOYSTICK_STICK_LENGTH,
  JOYSTICK_TILT,
} from '#src/constants'
import type { JoystickOptions, ScreenPoint } from '#src/types'
import { projectPlaneNormal, projectPlaneOffset, screenToPlaneOffset, snapToArtPixel } from '#src/utils/projection'

/**
 * Джойстик на панели управления: наклон панели заложен в рисунок основания, шар на стержне отклоняется в плоскости
 * панели. Стержень растёт из пыльника по нормали к панели.
 */
export class Joystick extends Container {
  private readonly base = new Sprite(Assets.get<Texture>(HUD_FRAMES.joystickBase))
  private readonly stick = new TilingSprite({ texture: Assets.get<Texture>(HUD_FRAMES.joystickStick) })
  private readonly ball = new Sprite(Assets.get<Texture>(HUD_FRAMES.joystickBall))
  /** Центр шара в нейтральном положении и верх пыльника. */
  private readonly rest = projectPlaneNormal(CONTROL_PANEL_PLANE, JOYSTICK_STICK_LENGTH * ART_PIXEL)
  private readonly bootTop = projectPlaneNormal(CONTROL_PANEL_PLANE, JOYSTICK_BOOT_HEIGHT * ART_PIXEL)
  private readonly onMove: (vector: ScreenPoint) => void
  private isDragging = false

  constructor(options: JoystickOptions) {
    super()

    this.onMove = options.onMove
    this.base.scale.set(ART_PIXEL)
    this.ball.scale.set(ART_PIXEL)
    this.tilt({ x: 0, y: 0 })

    this.addChild(this.base, this.stick, this.ball)

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
    for (const part of [this.base, this.stick, this.ball]) part.tint = enabled ? 0xffffff : DISABLED_TINT
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

  /**
   * Ограничивает жест окружностью в плоскости панели и возвращает его экранное направление. Шар отклоняется на ту же
   * долю своего хода.
   */
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
    const scale = (strength * JOYSTICK_TILT * ART_PIXEL) / distance
    const offset = projectPlaneOffset(CONTROL_PANEL_PLANE, plane.x * scale, plane.y * scale)
    const screenDistance = Math.hypot(offset.x, offset.y)

    this.tilt(offset)
    this.onMove({ x: (offset.x / screenDistance) * strength, y: (offset.y / screenDistance) * strength })
  }

  /** Ставит шар со смещением `offset` от нейтрального положения и тянет к нему стержень от верха пыльника. */
  private tilt(offset: ScreenPoint): void {
    const ball = snapToArtPixel({ x: this.rest.x + offset.x, y: this.rest.y + offset.y })
    const height = this.bootTop.y - ball.y
    const rows = Math.round(height / ART_PIXEL)
    const { width } = this.stick.texture

    this.ball.position.set(ball.x, ball.y)
    this.stick.setSize(width, rows)
    this.stick.tilePosition.set(0, rows)
    // Сдвиг строк ведёт стержень от центра шара к верху пыльника
    this.stick.setFromMatrix(
      new Matrix(
        ART_PIXEL,
        0,
        ((this.bootTop.x - ball.x) / height) * ART_PIXEL,
        ART_PIXEL,
        ball.x - (width / 2) * ART_PIXEL,
        ball.y
      )
    )
  }
}
