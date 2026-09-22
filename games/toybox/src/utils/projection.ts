import {
  AXIS_X,
  AXIS_Y,
  DEPTH_SCALE_MIN,
  GRID_SIZE,
  JOYSTICK_DEADZONE,
  PATH_STEP,
  TRAY_ORIGIN,
  TRAY_SIZE,
  TRAY_WALL_LAYERS,
  UNIT_HEIGHT,
} from '#src/constants'
import type { CellAddress, GroundPoint, ScreenPoint, WorldPoint } from '#src/types'
import type { Random } from '@pixi-demos/core/types'

import { clamp } from './math'

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
 * Переводит отклонение джойстика в направление хода по полю
 */
export const toGroundDirection = (vector: ScreenPoint): GroundPoint => {
  const tilt = Math.hypot(vector.x, vector.y)

  if (tilt <= JOYSTICK_DEADZONE) return { x: 0, y: 0 }

  const ground = screenToGround(vector)
  const length = Math.hypot(ground.x, ground.y)

  if (length === 0) return { x: 0, y: 0 }

  return { x: ground.x / length, y: ground.y / length }
}

/**
 * Луч взгляда в осях мира: вдоль него точки проецируются в одну точку экрана.
 * Находится из условия `worldToScreen(луч) = 0`, шаг по оси `y` принят за 1.
 */
const VIEW_X = -AXIS_Y.x / AXIS_X.x
const VIEW_Z = (AXIS_X.y * VIEW_X + AXIS_Y.y) / UNIT_HEIGHT

/** Порядок наложения точки: её смещение против луча взгляда. Чем больше, тем ближе к игроку. */
export const getDepthOrder = ({ x, y, z }: WorldPoint): number => -(x * VIEW_X + y + z * VIEW_Z)

/** Масштаб предмета на глубине `x`: у дальнего края поля он мельче, чем у ближнего. */
export const getDepthScale = (x: number): number => 1 - (1 - DEPTH_SCALE_MIN) * clamp(x / GRID_SIZE, 0, 1)

/**
 * Удерживает точку в пределах поля.
 */
export const clampToField = ({ x, y }: GroundPoint, margin = 0): GroundPoint => ({
  x: clamp(x, margin, GRID_SIZE - margin),
  y: clamp(y, margin, GRID_SIZE - margin),
})

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

export const toCell = ({ x, y }: GroundPoint): CellAddress => ({
  col: clamp(Math.floor(x), 0, GRID_SIZE - 1),
  row: clamp(Math.floor(y), 0, GRID_SIZE - 1),
})

/** Центр ячейки в координатах поля. */
export const getCellCenter = ({ col, row }: CellAddress): GroundPoint => ({ x: col + 0.5, y: row + 0.5 })

/** Лежит ли ячейка в квадранте лотка. */
export const isTrayCell = ({ col, row }: CellAddress): boolean =>
  col >= TRAY_ORIGIN.col &&
  col < TRAY_ORIGIN.col + TRAY_SIZE &&
  row >= TRAY_ORIGIN.row &&
  row < TRAY_ORIGIN.row + TRAY_SIZE

/**
 * Контуры двух граней, которыми лоток отгорожен от куба. Двух других граней у него нет —
 * там лоток прилегает к стенкам самого куба.
 */
export const getTrayWallOutlines = (): WorldPoint[][] => {
  const { col, row } = TRAY_ORIGIN
  const far = col + TRAY_SIZE
  const top = TRAY_WALL_LAYERS

  return [
    [
      { x: far, y: row, z: 0 },
      { x: far, y: row + TRAY_SIZE, z: 0 },
      { x: far, y: row + TRAY_SIZE, z: top },
      { x: far, y: row, z: top },
    ],
    [
      { x: col, y: row, z: 0 },
      { x: far, y: row, z: 0 },
      { x: far, y: row, z: top },
      { x: col, y: row, z: top },
    ],
  ]
}

/** Соседи ячейки по четырём сторонам, не выходящие за поле. */
export const getNeighbours = ({ col, row }: CellAddress): CellAddress[] =>
  [
    { col: col + 1, row },
    { col: col - 1, row },
    { col, row: row + 1 },
    { col, row: row - 1 },
  ].filter(({ col: c, row: r }) => c >= 0 && c < GRID_SIZE && r >= 0 && r < GRID_SIZE)

/** Доля пути от `from` до `to`, на которой путь проходит ближе всего к точке `at`. */
export const getPathShare = (from: GroundPoint, to: GroundPoint, at: GroundPoint): number => {
  const pathX = to.x - from.x
  const pathY = to.y - from.y
  const length = pathX * pathX + pathY * pathY

  if (length === 0) return 0

  return clamp(((at.x - from.x) * pathX + (at.y - from.y) * pathY) / length, 0, 1)
}

/** Ячейки, над которыми проходит путь между точками поля: в порядке хода и без повторов подряд. */
export const getPathCells = (from: GroundPoint, to: GroundPoint): CellAddress[] => {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  const steps = Math.max(Math.ceil(distance / PATH_STEP), 1)
  const cells: CellAddress[] = []

  for (let step = 0; step <= steps; step++) {
    const share = step / steps
    const cell = toCell({ x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share })
    const last = cells[cells.length - 1]

    if (!last || last.col !== cell.col || last.row !== cell.row) cells.push(cell)
  }

  return cells
}

/**
 * Выбирает ячейку, над которой клешня выронит игрушку по дороге из `from` в `to`.
 * Кандидаты — ячейки пути кроме стартовой и кроме лотка; `undefined` означает, что ронять негде.
 */
export const pickFumbleCell = (from: GroundPoint, to: GroundPoint, random: Random): CellAddress | undefined => {
  const candidates = getPathCells(from, to)
    .slice(1)
    .filter((cell) => !isTrayCell(cell))

  return candidates.length > 0 ? candidates[Math.floor(random() * candidates.length)] : undefined
}
