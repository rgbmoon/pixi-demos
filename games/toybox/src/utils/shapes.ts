import { SHAPES, TOY_LAYER_CENTER } from '#src/constants'
import type { CellAddress, Facing, ShapeCell, ShapeKey, VolumeCell, WorldPoint } from '#src/types'

import { getCellCenter } from './projection'

/** Число клеток формы. */
export const getWeight = (shape: ShapeKey): number => SHAPES[shape].cells.length

/** Поворот ориентации на `steps` четвертей оборота. */
export const rotateFacing = (facing: Facing, steps: number): Facing => ((((facing + steps) % 4) + 4) % 4) as Facing

/** Четверть оборота клетки формы вокруг вертикальной оси: `(dx, dy)` переходит в `(-dy, dx)`. */
const turnCell = ({ dx, dy, dz }: ShapeCell, facing: Facing): ShapeCell => {
  if (facing === 1) return { dx: -dy, dy: dx, dz }
  if (facing === 2) return { dx: -dx, dy: -dy, dz }
  if (facing === 3) return { dx: dy, dy: -dx, dz }

  return { dx, dy, dz }
}

/**
 * Клетки формы в ориентации `facing`, приведённые к нулевому якорю: после поворота смещения
 * сдвигаются так, что минимальные `dx` и `dy` снова равны нулю. Поэтому четыре поворота подряд
 * возвращают исходный набор.
 */
export const getShapeCells = (shape: ShapeKey, facing: Facing): ShapeCell[] => {
  const turned = SHAPES[shape].cells.map((cell) => turnCell(cell, facing))
  const minX = Math.min(...turned.map(({ dx }) => dx))
  const minY = Math.min(...turned.map(({ dy }) => dy))

  return turned.map(({ dx, dy, dz }) => ({ dx: dx - minX, dy: dy - minY, dz }))
}

/** Возвращает клетки формы для заданных якоря, ориентации и слоя. */
export const getPlacementCells = (
  shape: ShapeKey,
  facing: Facing,
  anchor: CellAddress,
  layer: number
): VolumeCell[] =>
  getShapeCells(shape, facing).map(({ dx, dy, dz }) => ({
    col: anchor.col + dx,
    row: anchor.row + dy,
    layer: layer + dz,
  }))

/** Возвращает самую нижнюю клетку каждого столбца формы. */
export const getBottomCells = (cells: readonly VolumeCell[]): VolumeCell[] => {
  const lowest = new Map<string, VolumeCell>()

  for (const cell of cells) {
    const key = `${cell.col}:${cell.row}`
    const current = lowest.get(key)

    if (!current || cell.layer < current.layer) lowest.set(key, cell)
  }

  return [...lowest.values()]
}

/** Середина формы в её смещениях: по ней игрушка ставится на экране, а не по якорю. */
export const getShapeCenter = (shape: ShapeKey, facing: Facing): ShapeCell => {
  const cells = getShapeCells(shape, facing)
  const sum = cells.reduce(
    (total, { dx, dy, dz }) => ({ dx: total.dx + dx, dy: total.dy + dy, dz: total.dz + dz }),
    { dx: 0, dy: 0, dz: 0 }
  )

  return { dx: sum.dx / cells.length, dy: sum.dy / cells.length, dz: sum.dz / cells.length }
}

/** Точка мира, в которой стоит середина игрушки. */
export const getBodyCenter = (shape: ShapeKey, facing: Facing, anchor: CellAddress, layer: number): WorldPoint => {
  const { dx, dy, dz } = getShapeCenter(shape, facing)

  return { ...getCellCenter({ col: anchor.col + dx, row: anchor.row + dy }), z: layer + dz + TOY_LAYER_CENTER }
}
