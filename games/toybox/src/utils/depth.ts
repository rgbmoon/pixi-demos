import { DEPTH_OVERLAP_TOLERANCE, TOY_INSET } from '#src/constants'
import type { DepthItem, PlaneVector, ScreenPoint, ShapeKey, WorldPoint } from '#src/types'

import { getAxes, getBounds, getConvexHull, getSeparation, projectPolygon } from './geometry'
import { getDepthOrder, getViewRay, worldToScreen } from './projection'
import { getPrismOutline, getSection, getVariant, placeSection, toPlane } from './shapes'

/** Допуск сравнения границ глубины: касание срезов не считается их пересечением. */
const DEPTH_EPSILON = 1e-6

/** Собирает предмет сортировки и заранее считает его оси проверки и рамку. */
const createItem = (
  near: number,
  far: number,
  section: readonly PlaneVector[],
  outline: readonly ScreenPoint[],
  key: number
): DepthItem => ({
  near,
  far,
  section,
  outline,
  sectionAxes: getAxes(section),
  outlineAxes: getAxes(outline),
  bounds: getBounds(outline),
  key,
})

/**
 * Ближе ли `first` к игроку, чем `second`, там, где их силуэты пересекаются. Непересекающиеся диапазоны
 * глубины разделены плоскостью `x = const`, и ближе меньший `x`. Иначе тела делят срез и разделены
 * прямой в плоскости `(y, z)`: ближе то, что лежит на стороне прямой, откуда приходит луч взгляда.
 */
const isInFront = (first: DepthItem, second: DepthItem): boolean => {
  if (first.far <= second.near + DEPTH_EPSILON) return true
  if (second.far <= first.near + DEPTH_EPSILON) return false

  const { axis } = getSeparation(first.section, second.section, first.sectionAxes, second.sectionAxes)
  const ray = getViewRay()
  const along = axis.x * ray.y + axis.y * ray.z

  // Прямая идёт вдоль луча: силуэты не пересекаются, порядок решает запасной ключ
  if (Math.abs(along) < DEPTH_EPSILON) return first.key > second.key

  const projectionA = projectPolygon(first.section, axis)
  const projectionB = projectPolygon(second.section, axis)
  const centerA = (projectionA.min + projectionA.max) / 2
  const centerB = (projectionB.min + projectionB.max) / 2

  return along > 0 ? centerA < centerB : centerA > centerB
}

/**
 * Отношение наложения двух предметов: знак — кто ближе к игроку там, где силуэты пересекаются (плюс —
 * `first`), модуль — глубина пересечения силуэтов в единицах сцены. Ноль — силуэты не пересекаются глубже
 * допуска, и порядок между предметами не нужен.
 */
export const getDepthRelation = (first: DepthItem, second: DepthItem): number => {
  const a = first.bounds
  const b = second.bounds

  if (a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top) return 0

  const { gap } = getSeparation(first.outline, second.outline, first.outlineAxes, second.outlineAxes)

  if (gap >= -DEPTH_OVERLAP_TOLERANCE) return 0

  return isInFront(first, second) ? -gap : gap
}

/**
 * Порядок отрисовки предметов, от дальнего к ближнему: индексы в `items`. Отношение пары даёт `relate`,
 * рёбра порядка ставятся только между пересекающимися предметами. Очередь упорядочена запасным ключом.
 * Цикл пересечений один порядок не выражает: разрывается он на предмете с наименьшей суммарной глубиной
 * нарушенных пересечений, поэтому ошибка остаётся там, где её меньше видно.
 */
export const orderByDepth = (items: readonly DepthItem[], relate: (first: number, second: number) => number): number[] => {
  const count = items.length
  const after: { front: number; weight: number }[][] = items.map(() => [])
  const incoming = new Array<number>(count).fill(0)
  const blocked = new Array<number>(count).fill(0)

  for (let first = 0; first < count; first++) {
    for (let second = first + 1; second < count; second++) {
      const relation = relate(first, second)

      if (relation === 0) continue

      const [back, front] = relation > 0 ? [second, first] : [first, second]
      const weight = Math.abs(relation)

      after[back].push({ front, weight })
      incoming[front] += 1
      blocked[front] += weight
    }
  }

  const order: number[] = []
  const placed = new Array<boolean>(count).fill(false)

  while (order.length < count) {
    let next = -1

    for (let index = 0; index < count; index++) {
      if (placed[index] || incoming[index] > 0) continue
      if (next === -1 || items[index].key < items[next].key) next = index
    }

    if (next === -1) {
      for (let index = 0; index < count; index++) {
        if (placed[index]) continue
        if (next === -1 || blocked[index] < blocked[next]) next = index
      }
    }

    placed[next] = true
    order.push(next)

    for (const { front, weight } of after[next]) {
      incoming[front] -= 1
      blocked[front] -= weight
    }
  }

  return order
}

/** Порядок отрисовки предметов, от дальнего к ближнему, со сравнением каждой пары заново. */
export const sortByDepth = (items: readonly DepthItem[]): number[] =>
  orderByDepth(items, (first, second) => getDepthRelation(items[first], items[second]))

/** Предмет сортировки для игрушки: центр позы и крен. */
export const getToyDepthItem = (shape: ShapeKey, variant: number, point: WorldPoint, angle: number): DepthItem => {
  const { depth } = getVariant(shape, variant)
  const section = getSection(shape, variant)
  const center = worldToScreen(point)
  const half = (depth * TOY_INSET) / 2

  return createItem(
    point.x - half,
    point.x + half,
    toPlane(placeSection(section, { y: point.y, z: point.z, angle })),
    getPrismOutline(section, depth, angle).map(({ x, y }) => ({ x: x + center.x, y: y + center.y })),
    getDepthOrder(point)
  )
}

/** Предмет сортировки для плоской детали куба — грани или ребра, заданных точками мира. */
export const getPlaneDepthItem = (points: readonly WorldPoint[]): DepthItem => {
  const centroid = {
    x: points.reduce((sum, { x }) => sum + x, 0) / points.length,
    y: points.reduce((sum, { y }) => sum + y, 0) / points.length,
    z: points.reduce((sum, { z }) => sum + z, 0) / points.length,
  }

  return createItem(
    Math.min(...points.map(({ x }) => x)),
    Math.max(...points.map(({ x }) => x)),
    getConvexHull(points.map(({ y, z }) => ({ x: y, y: z }))),
    getConvexHull(points.map((point) => worldToScreen(point))),
    getDepthOrder(centroid)
  )
}

/** Предмет сортировки для точки мира: клешня. `radius` — полусторона на экране, `sectionRadius` — в клетках. */
export const getPointDepthItem = (point: WorldPoint, radius: number, sectionRadius: number): DepthItem => {
  const center = worldToScreen(point)
  const square = (cx: number, cy: number, half: number): PlaneVector[] => [
    { x: cx - half, y: cy - half },
    { x: cx + half, y: cy - half },
    { x: cx + half, y: cy + half },
    { x: cx - half, y: cy + half },
  ]

  return createItem(
    point.x,
    point.x,
    square(point.y, point.z, sectionRadius),
    square(center.x, center.y, radius),
    getDepthOrder(point)
  )
}
