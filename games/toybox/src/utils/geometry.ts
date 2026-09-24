import type { PlaneVector, ScreenRect } from '#src/types'

/** Допуск сравнений: зазор меньше него считается касанием. */
const EPSILON = 1e-9

/** Ориентация тройки точек: положительная означает поворот против часовой стрелки. */
const getTurn = (origin: PlaneVector, first: PlaneVector, second: PlaneVector): number =>
  (first.x - origin.x) * (second.y - origin.y) - (first.y - origin.y) * (second.x - origin.x)

/** Выпуклая оболочка набора точек, обходом Эндрю. */
export const getConvexHull = (points: readonly PlaneVector[]): PlaneVector[] => {
  const sorted = [...points].sort((left, right) => left.x - right.x || left.y - right.y)

  if (sorted.length < 3) return sorted

  const build = (source: readonly PlaneVector[]): PlaneVector[] => {
    const chain: PlaneVector[] = []

    for (const point of source) {
      while (chain.length >= 2 && getTurn(chain[chain.length - 2], chain[chain.length - 1], point) <= 0) {
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

/** Оси проверки для выпуклой фигуры: нормали рёбер, у отрезка — ещё и его направление. */
export const getAxes = (polygon: readonly PlaneVector[]): PlaneVector[] => {
  if (polygon.length < 2) return []

  const edges = polygon.length === 2 ? [[polygon[0], polygon[1]]] : polygon.map((point, index) => [point, polygon[(index + 1) % polygon.length]])
  const axes = edges.map(([from, to]) => ({ x: from.y - to.y, y: to.x - from.x }))

  if (polygon.length === 2) axes.push({ x: polygon[1].x - polygon[0].x, y: polygon[1].y - polygon[0].y })

  return axes
    .map((axis) => ({ axis, length: Math.hypot(axis.x, axis.y) }))
    .filter(({ length }) => length > EPSILON)
    .map(({ axis, length }) => ({ x: axis.x / length, y: axis.y / length }))
}

/** Проекция фигуры на ось: наименьшее и наибольшее скалярное произведение вершин. */
export const projectPolygon = (polygon: readonly PlaneVector[], axis: PlaneVector): { min: number; max: number } => {
  let min = Infinity
  let max = -Infinity

  for (const { x, y } of polygon) {
    const value = x * axis.x + y * axis.y

    if (value < min) min = value
    if (value > max) max = value
  }

  return { min, max }
}

/**
 * Разделение двух выпуклых фигур: ось с наибольшим зазором между их проекциями и сам зазор.
 * Положительный зазор — фигуры разделены вдоль оси, отрицательный — глубина их пересечения.
 * Фигура может быть точкой или отрезком. Заранее посчитанные оси фигур передаются третьим и четвёртым
 * аргументами.
 */
export const getSeparation = (
  first: readonly PlaneVector[],
  second: readonly PlaneVector[],
  firstAxes: readonly PlaneVector[] = getAxes(first),
  secondAxes: readonly PlaneVector[] = getAxes(second)
): { axis: PlaneVector; gap: number } => {
  const axes = [...firstAxes, ...secondAxes]

  // У двух точек рёбер нет: разделяет их направление от одной к другой
  if (axes.length === 0) {
    const dx = second[0].x - first[0].x
    const dy = second[0].y - first[0].y
    const length = Math.hypot(dx, dy)

    return length > EPSILON ? { axis: { x: dx / length, y: dy / length }, gap: length } : { axis: { x: 1, y: 0 }, gap: 0 }
  }

  let best = { axis: axes[0], gap: -Infinity }

  for (const axis of axes) {
    const a = projectPolygon(first, axis)
    const b = projectPolygon(second, axis)
    const gap = Math.max(b.min - a.max, a.min - b.max)

    if (gap > best.gap) best = { axis, gap }
  }

  return best
}

/** Пересекаются ли выпуклые фигуры глубже допуска `tolerance`. */
export const polygonsOverlap = (first: readonly PlaneVector[], second: readonly PlaneVector[], tolerance = 0): boolean =>
  getSeparation(first, second).gap < -tolerance

/** Рамка набора точек, выровненная по осям. */
export const getBounds = (points: readonly PlaneVector[]): ScreenRect => {
  let left = Infinity
  let right = -Infinity
  let top = Infinity
  let bottom = -Infinity

  for (const { x, y } of points) {
    if (x < left) left = x
    if (x > right) right = x
    if (y < top) top = y
    if (y > bottom) bottom = y
  }

  return { left, right, top, bottom }
}
