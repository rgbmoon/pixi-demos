import { TOY_OUTLINE_STEPS, TOY_RADIUS } from '#src/constants'
import type { Facing, ScreenPoint, ShapeKey } from '#src/types'
import { getDepthOrder, worldToScreen } from '#src/utils/projection'
import { getShapeCells, getShapeCenter } from '#src/utils/shapes'

/** Ориентация тройки точек: положительная означает поворот против часовой стрелки экрана. */
const getTurnSide = (origin: ScreenPoint, first: ScreenPoint, second: ScreenPoint): number =>
  (first.x - origin.x) * (second.y - origin.y) - (first.y - origin.y) * (second.x - origin.x)

/** Выпуклая оболочка набора точек, обходом Эндрю. */
const getConvexHull = (points: readonly ScreenPoint[]): ScreenPoint[] => {
  const sorted = [...points].sort((left, right) => left.x - right.x || left.y - right.y)

  if (sorted.length < 3) return sorted

  const build = (source: readonly ScreenPoint[]): ScreenPoint[] => {
    const chain: ScreenPoint[] = []

    for (const point of source) {
      while (chain.length >= 2 && getTurnSide(chain[chain.length - 2], chain[chain.length - 1], point) <= 0) {
        chain.pop()
      }

      chain.push(point)
    }

    return chain
  }

  const lower = build(sorted)
  const upper = build([...sorted].reverse())

  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

/**
 * Контур игрушки на экране: выпуклая оболочка центров её клеток, раздутая на радиус игрушки.
 * Выпуклая оболочка окружностей вокруг центров клеток образует единый силуэт составной формы.
 */
export const getShapeOutline = (shape: ShapeKey, facing: Facing): ScreenPoint[] => {
  const center = getShapeCenter(shape, facing)
  const samples = getShapeCells(shape, facing).flatMap(({ dx, dy, dz }) => {
    const origin = worldToScreen({ x: dx - center.dx, y: dy - center.dy, z: dz - center.dz })

    return Array.from({ length: TOY_OUTLINE_STEPS }, (_, step) => {
      const angle = (2 * Math.PI * step) / TOY_OUTLINE_STEPS

      return { x: origin.x + Math.cos(angle) * TOY_RADIUS, y: origin.y + Math.sin(angle) * TOY_RADIUS }
    })
  })

  return getConvexHull(samples)
}

/** Смещение ключа глубины ближайшей клетки относительно центра формы; не зависит от её позиции. */
export const getShapeDepthOffset = (shape: ShapeKey, facing: Facing): number => {
  const center = getShapeCenter(shape, facing)

  return Math.max(
    ...getShapeCells(shape, facing).map(({ dx, dy, dz }) =>
      getDepthOrder({ x: dx - center.dx, y: dy - center.dy, z: dz - center.dz })
    )
  )
}
