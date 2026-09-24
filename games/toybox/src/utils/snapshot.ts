import { CUBE_HEIGHT, GRID_SIZE, HEAP_SNAPSHOT_VERSION } from '#src/constants'
import { SHAPES } from '#src/toys'
import type { HeapSnapshot, HeapSnapshotBody, ShapeKey } from '#src/types'

/** Предел числа игрушек в снимке: куча столько не вмещает, больший список — мусор. */
const MAX_BODIES = GRID_SIZE * GRID_SIZE * CUBE_HEIGHT

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const isInteger = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
const isNumberIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const isShapeKey = (value: unknown): value is ShapeKey => typeof value === 'string' && Object.hasOwn(SHAPES, value)

const isSnapshotBody = (value: unknown): value is HeapSnapshotBody => {
  if (!isRecord(value)) return false

  const { shape, variant, slab, y, z, angle, color } = value

  if (!isShapeKey(shape)) return false

  const { variants } = SHAPES[shape]

  if (!isInteger(variant, 0, variants.length - 1)) return false

  return (
    isInteger(slab, 0, GRID_SIZE - variants[variant].depth) &&
    isNumberIn(y, 0, GRID_SIZE) &&
    isNumberIn(z, 0, CUBE_HEIGHT) &&
    isNumberIn(angle, -Number.MAX_VALUE, Number.MAX_VALUE) &&
    isInteger(color, 0, 0xffffff)
  )
}

/** Проверяет весь снимок до загрузки: версию, схему и диапазоны каждой игрушки. */
export const isHeapSnapshot = (value: unknown): value is HeapSnapshot =>
  isRecord(value) &&
  value.version === HEAP_SNAPSHOT_VERSION &&
  isInteger(value.collected, 0, Number.MAX_SAFE_INTEGER) &&
  Array.isArray(value.bodies) &&
  value.bodies.length <= MAX_BODIES &&
  value.bodies.every(isSnapshotBody)
