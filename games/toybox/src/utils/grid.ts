import { GRID_SIZE, TRAY_ORIGIN, TRAY_SIZE, TRAY_WALL_LAYERS } from '#src/constants'
import type { CellAddress, GroundPoint, PathCell, WorldPoint } from '#src/types'
import type { Random } from '@pixi-demos/core/types'

import { clamp } from './math'

/** Ячейка поля, в которой лежит точка; точка вне поля относится к ближайшей крайней ячейке. */
export const toCell = ({ x, y }: GroundPoint): CellAddress => ({
  col: clamp(Math.floor(x), 0, GRID_SIZE - 1),
  row: clamp(Math.floor(y), 0, GRID_SIZE - 1),
})

/** Центр ячейки в координатах поля. */
export const getCellCenter = ({ col, row }: CellAddress): GroundPoint => ({ x: col + 0.5, y: row + 0.5 })

/** Числовой ключ столбца для множеств и словарей. */
export const getColumnKey = ({ col, row }: CellAddress): number => col * GRID_SIZE + row

/**
 * Удерживает точку в пределах поля.
 */
export const clampToField = ({ x, y }: GroundPoint, margin = 0): GroundPoint => ({
  x: clamp(x, margin, GRID_SIZE - margin),
  y: clamp(y, margin, GRID_SIZE - margin),
})

/** Лежит ли ячейка в квадранте лотка. */
export const isTrayCell = ({ col, row }: CellAddress): boolean =>
  col >= TRAY_ORIGIN.col &&
  col < TRAY_ORIGIN.col + TRAY_SIZE &&
  row >= TRAY_ORIGIN.row &&
  row < TRAY_ORIGIN.row + TRAY_SIZE

/** Соседи ячейки по четырём сторонам, не выходящие за поле. */
export const getNeighbours = ({ col, row }: CellAddress): CellAddress[] =>
  [
    { col: col + 1, row },
    { col: col - 1, row },
    { col, row: row + 1 },
    { col, row: row - 1 },
  ].filter(({ col: c, row: r }) => c >= 0 && c < GRID_SIZE && r >= 0 && r < GRID_SIZE)

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
