import {
  AXIS_X,
  AXIS_Y,
  CLAW_ACCELERATION,
  CLAW_BRAKE_ACCELERATION,
  CLAW_BRAKE_MS,
  CLAW_MIN_SPEED,
  CLAW_RESPONSE_MS,
  DEPTH_SCALE_MIN,
  GRID_SIZE,
  JOYSTICK_DEADZONE,
  JOYSTICK_FULL_TILT,
  TRAY_ORIGIN,
  TRAY_SIZE,
  UNIT_HEIGHT,
} from './constants'
import type { GroundPoint, ScreenPoint, WorldPoint } from './types'

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

/** Определитель осей проекции: он же множитель обратного перевода. */
const AXES_DETERMINANT = AXIS_X.x * AXIS_Y.y - AXIS_X.y * AXIS_Y.x

/**
 * Переводит точку мира в экранные дизайн-единицы. Начало координат — ближний угол пола:
 * ось `x` уходит вглубь сцены, ось `y` — вдоль фронтальной грани влево, высота `z` поднимает точку.
 */
export const worldToScreen = ({ x, y, z }: WorldPoint): ScreenPoint => ({
  x: x * AXIS_X.x + y * AXIS_Y.x,
  y: x * AXIS_X.y + y * AXIS_Y.y - z * UNIT_HEIGHT,
})

/**
 * Переводит экранный вектор в оси поля — обращение `worldToScreen` на плоскости `z` = 0.
 * По нему отклонение джойстика становится направлением хода клешни.
 */
export const screenToGround = ({ x, y }: ScreenPoint): GroundPoint => ({
  x: (x * AXIS_Y.y - y * AXIS_Y.x) / AXES_DETERMINANT,
  y: (AXIS_X.x * y - AXIS_X.y * x) / AXES_DETERMINANT,
})

/**
 * Переводит отклонение джойстика в направление хода по полю: сторону берёт из проекции, а силу —
 * из хода ручки за вычетом мёртвой зоны. Ход сверх `JOYSTICK_FULL_TILT` уже ничего не добавляет,
 * поэтому джойстик ощущается как переключатель, а не как аналоговый стик.
 */
export const toGroundDirection = (vector: ScreenPoint): GroundPoint => {
  const tilt = Math.hypot(vector.x, vector.y)

  if (tilt <= JOYSTICK_DEADZONE) return { x: 0, y: 0 }

  const ground = screenToGround(vector)
  const length = Math.hypot(ground.x, ground.y)

  if (length === 0) return { x: 0, y: 0 }

  const strength = clamp((tilt - JOYSTICK_DEADZONE) / (JOYSTICK_FULL_TILT - JOYSTICK_DEADZONE), 0, 1)

  return { x: (ground.x / length) * strength, y: (ground.y / length) * strength }
}

/** Масштаб предмета на глубине `x`: у дальнего края поля он мельче, чем у ближнего. */
export const getDepthScale = (x: number): number => 1 - (1 - DEPTH_SCALE_MIN) * clamp(x / GRID_SIZE, 0, 1)

/** Удерживает точку в пределах поля. */
export const clampToField = ({ x, y }: GroundPoint): GroundPoint => ({
  x: clamp(x, 0, GRID_SIZE),
  y: clamp(y, 0, GRID_SIZE),
})

/**
 * Ведёт скорость клешни к целевой за `deltaMs`. Скорость приближается к цели экспоненциально,
 * а её прирост за кадр ограничен ускорением: полное отклонение джойстика упирается в этот предел и
 * разгоняется кривой, слабое — выходит на свою небольшую цель почти сразу. Нулевая цель тормозит
 * отдельным, много большим пределом и гасит остаток скорости.
 */
export const advanceVelocity = (velocity: GroundPoint, target: GroundPoint, deltaMs: number): GroundPoint => {
  const gapX = target.x - velocity.x
  const gapY = target.y - velocity.y
  const gap = Math.hypot(gapX, gapY)

  if (gap === 0) return velocity

  const isBraking = target.x === 0 && target.y === 0
  const limit = ((isBraking ? CLAW_BRAKE_ACCELERATION : CLAW_ACCELERATION) * deltaMs) / 1000
  const responseMs = isBraking ? CLAW_BRAKE_MS : CLAW_RESPONSE_MS
  const change = Math.min(gap * (1 - Math.exp(-deltaMs / responseMs)), limit)
  const next = { x: velocity.x + (gapX / gap) * change, y: velocity.y + (gapY / gap) * change }

  return isBraking && Math.hypot(next.x, next.y) < CLAW_MIN_SPEED ? { x: 0, y: 0 } : next
}

/** Контур грани куба на высоте `z`: четыре угла в порядке обхода. */
export const getFaceOutline = (z: number): WorldPoint[] => [
  { x: 0, y: 0, z },
  { x: GRID_SIZE, y: 0, z },
  { x: GRID_SIZE, y: GRID_SIZE, z },
  { x: 0, y: GRID_SIZE, z },
]

/** Контур лотка на полу: четыре угла его квадранта в порядке обхода. */
export const getTrayOutline = (): WorldPoint[] => {
  const { col, row } = TRAY_ORIGIN

  return [
    { x: col, y: row, z: 0 },
    { x: col + TRAY_SIZE, y: row, z: 0 },
    { x: col + TRAY_SIZE, y: row + TRAY_SIZE, z: 0 },
    { x: col, y: row + TRAY_SIZE, z: 0 },
  ]
}
