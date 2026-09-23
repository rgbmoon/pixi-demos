import {
  AXIS_X,
  AXIS_Y,
  GRID_SIZE,
  JOYSTICK_DEADZONE,
  TRAY_ORIGIN,
  TRAY_SIZE,
  TRAY_WALL_LAYERS,
  UNIT_HEIGHT,
} from '#src/constants'
import type { CellAddress, GroundPoint, PathCell, ScreenPoint, WorldPoint } from '#src/types'
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

/** После мёртвой зоны возвращает единичное направление по полю, внутри неё — нулевой вектор. */
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

/** Интервалы пересечения ячеек. Касание угла без участка пути отдельной ячейкой не считается. */
export const getPathIntervals = (from: GroundPoint, to: GroundPoint): PathCell[] => {
  const shares = new Set([0, 1])

  for (const axis of ['x', 'y'] as const) {
    const distance = to[axis] - from[axis]

    if (distance === 0) continue

    const first = Math.floor(Math.min(from[axis], to[axis])) + 1
    const last = Math.max(from[axis], to[axis])

    for (let boundary = first; boundary < last; boundary++) {
      shares.add((boundary - from[axis]) / distance)
    }
  }

  const sorted = [...shares].sort((a, b) => a - b)
  const intervals: PathCell[] = []

  for (let index = 1; index < sorted.length; index++) {
    const enter = sorted[index - 1]
    const exit = sorted[index]
    const share = (enter + exit) / 2
    const cell = toCell({ x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share })
    const last = intervals[intervals.length - 1]

    if (last && last.cell.col === cell.col && last.cell.row === cell.row) last.exit = exit
    else intervals.push({ cell, enter, exit })
  }

  return intervals
}

/** Ячейки маршрута, включая его начальную и конечную точки, без повторов подряд. */
export const getPathCells = (from: GroundPoint, to: GroundPoint): CellAddress[] => {
  const cells = [toCell(from), ...getPathIntervals(from, to).map(({ cell }) => cell), toCell(to)]

  return cells.filter(
    (cell, index) => index === 0 || cell.col !== cells[index - 1].col || cell.row !== cells[index - 1].row
  )
}

/** Выбирает участок маршрута вне стартовой ячейки и лотка. */
export const pickFumbleCell = (from: GroundPoint, to: GroundPoint, random: Random): PathCell | undefined => {
  const start = toCell(from)
  const candidates = getPathIntervals(from, to).filter(
    ({ cell }) => (cell.col !== start.col || cell.row !== start.row) && !isTrayCell(cell)
  )

  return candidates.length > 0 ? candidates[Math.floor(random() * candidates.length)] : undefined
}
