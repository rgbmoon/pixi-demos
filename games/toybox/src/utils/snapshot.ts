import { GRID_SIZE, HEAP_SNAPSHOT_VERSION, MAX_LAYERS, SHAPES } from '#src/constants'
import type { HeapSnapshot } from '#src/types'

import { isBoxCell } from './heap'
import { getPlacementCells } from './shapes'

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const isInteger = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max

const isSnapshotBody = (value: unknown): value is HeapSnapshot['bodies'][number] => {
  if (!isRecord(value)) return false

  const { shape, facing, anchor, layer, color } = value

  return (
    typeof shape === 'string' &&
    Object.hasOwn(SHAPES, shape) &&
    isInteger(facing, 0, 3) &&
    isRecord(anchor) &&
    isInteger(anchor.col, 0, GRID_SIZE - 1) &&
    isInteger(anchor.row, 0, GRID_SIZE - 1) &&
    isInteger(layer, 0, MAX_LAYERS - 1) &&
    isInteger(color, 0, 0xffffff)
  )
}

/** Проверяет весь снимок до загрузки: схему, диапазоны, клетки форм и отсутствие пересечений. */
export const isHeapSnapshot = (value: unknown): value is HeapSnapshot => {
  if (
    !isRecord(value) ||
    value.version !== HEAP_SNAPSHOT_VERSION ||
    !isInteger(value.collected, 0, Number.MAX_SAFE_INTEGER) ||
    !Array.isArray(value.bodies) ||
    value.bodies.length > GRID_SIZE * GRID_SIZE * MAX_LAYERS ||
    !value.bodies.every(isSnapshotBody)
  ) {
    return false
  }

  const occupied = new Set<string>()

  for (const { shape, facing, anchor, layer } of value.bodies) {
    for (const cell of getPlacementCells(shape, facing, anchor, layer)) {
      const key = `${cell.col}:${cell.row}:${cell.layer}`

      if (!isBoxCell(cell) || occupied.has(key)) return false
      occupied.add(key)
    }
  }

  return true
}
