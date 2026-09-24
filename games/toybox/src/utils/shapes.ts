import { CORNER_EDGE_SHARE, TOY_ANGLE_STEP, TOY_INSET } from '#src/constants'
import { SHAPES } from '#src/toys'
import type { PlaneVector, ScreenPoint, SectionPoint, ShapeKey, ShapeVariant, ToyPose } from '#src/types'

import { getConvexHull } from './geometry'
import { worldToScreen } from './projection'

/** Вес формы в клетках: от него зависят шанс захвата и масса тела. */
export const getWeight = (shape: ShapeKey): number => SHAPES[shape].weight

/** Положение формы из каталога. */
export const getVariant = (shape: ShapeKey, variant: number): ShapeVariant => SHAPES[shape].variants[variant]

/** Число положений формы в каталоге. */
export const getVariantCount = (shape: ShapeKey): number => SHAPES[shape].variants.length

/**
 * Скругляет углы выпуклого многоугольника: у каждой вершины срез на `radius` вдоль обоих рёбер и точка
 * квадратичной кривой между срезами. Радиус ограничен долей ребра, поэтому соседние скругления не пересекаются.
 */
const roundCorners = (section: readonly SectionPoint[], radius: number): SectionPoint[] =>
  section.flatMap((point, index) => {
    const previous = section[(index + section.length - 1) % section.length]
    const next = section[(index + 1) % section.length]
    const toPrevious = Math.hypot(previous.y - point.y, previous.z - point.z)
    const toNext = Math.hypot(next.y - point.y, next.z - point.z)
    const cutPrevious = Math.min(radius, toPrevious * CORNER_EDGE_SHARE) / toPrevious
    const cutNext = Math.min(radius, toNext * CORNER_EDGE_SHARE) / toNext
    const start = { y: point.y + (previous.y - point.y) * cutPrevious, z: point.z + (previous.z - point.z) * cutPrevious }
    const end = { y: point.y + (next.y - point.y) * cutNext, z: point.z + (next.z - point.z) * cutNext }

    return [
      start,
      { y: (start.y + 2 * point.y + end.y) / 4, z: (start.z + 2 * point.z + end.z) / 4 },
      end,
    ]
  })

/** Центр масс выпуклого многоугольника. */
const getCentroid = (section: readonly SectionPoint[]): SectionPoint => {
  let area = 0
  let y = 0
  let z = 0

  section.forEach((point, index) => {
    const next = section[(index + 1) % section.length]
    const cross = point.y * next.z - next.y * point.z

    area += cross
    y += (point.y + next.y) * cross
    z += (point.z + next.z) * cross
  })

  return { y: y / (3 * area), z: z / (3 * area) }
}

/** Сечение тела: многоугольник каталога со скруглёнными углами, перенесённый в центр масс и уменьшенный на `TOY_INSET`. */
const buildSections = (shape: ShapeKey): readonly (readonly SectionPoint[])[] =>
  SHAPES[shape].variants.map(({ section, radius }) => {
    const rounded = roundCorners(section, radius)
    const centroid = getCentroid(rounded)

    return rounded.map(({ y, z }) => ({ y: (y - centroid.y) * TOY_INSET, z: (z - centroid.z) * TOY_INSET }))
  })

/** Сечения тел всех форм во всех положениях: их читают физика, рендер и сортировка наложения. */
const SECTION_TABLE: Record<ShapeKey, readonly (readonly SectionPoint[])[]> = {
  single: buildSections('single'),
  bar2: buildSections('bar2'),
  square4: buildSections('square4'),
  cube8: buildSections('cube8'),
  triangle: buildSections('triangle'),
}

/** Сечение тела игрушки относительно её центра, без крена. */
export const getSection = (shape: ShapeKey, variant: number): readonly SectionPoint[] => SECTION_TABLE[shape][variant]

/** Площадь выпуклого сечения. */
export const getSectionArea = (section: readonly SectionPoint[]): number =>
  Math.abs(
    section.reduce((sum, point, index) => {
      const next = section[(index + 1) % section.length]

      return sum + point.y * next.z - next.y * point.z
    }, 0)
  ) / 2

/** Наибольшие отступы сечения от центра по осям. */
export const getSectionExtent = (section: readonly SectionPoint[]): { halfWidth: number; halfHeight: number } => ({
  halfWidth: Math.max(...section.map(({ y }) => Math.abs(y))),
  halfHeight: Math.max(...section.map(({ z }) => Math.abs(z))),
})

/** Сечение, повёрнутое на крен позы и перенесённое в её центр. */
export const placeSection = (section: readonly SectionPoint[], { y, z, angle }: ToyPose): SectionPoint[] => {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  return section.map((point) => ({ y: y + point.y * cos - point.z * sin, z: z + point.y * sin + point.z * cos }))
}

/** Сечение как фигура плоскости для геометрических проверок: `y` идёт в `x`, `z` — в `y`. */
export const toPlane = (section: readonly SectionPoint[]): PlaneVector[] => section.map(({ y, z }) => ({ x: y, y: z }))

/** Центр игрушки по глубине: середина занятых срезов. */
export const getDepthCenter = (slab: number, depth: number): number => slab + depth / 2

/**
 * Экранный силуэт тела относительно его центра: выпуклая оболочка проекций сечения на ближней и
 * дальней границе глубины.
 */
export const getPrismOutline = (section: readonly SectionPoint[], depth: number, angle: number): ScreenPoint[] => {
  const half = (depth * TOY_INSET) / 2
  const turned = placeSection(section, { y: 0, z: 0, angle })

  return getConvexHull(
    [-half, half].flatMap((x) => turned.map(({ y, z }) => worldToScreen({ x, y, z })))
  )
}

/** Число шагов угла на полный оборот. */
const ANGLE_STEPS = Math.round((2 * Math.PI) / TOY_ANGLE_STEP)

/** Номер шага угла, ближайшего к крену: по нему выбирается кэшированный силуэт. */
export const getAngleStep = (angle: number): number =>
  ((Math.round(angle / TOY_ANGLE_STEP) % ANGLE_STEPS) + ANGLE_STEPS) % ANGLE_STEPS

/** Экранный силуэт игрушки относительно её центра на шаге угла `step`: проекция призмы тела. */
export const getShapeOutline = (shape: ShapeKey, variant: number, step: number): ScreenPoint[] =>
  getPrismOutline(getSection(shape, variant), getVariant(shape, variant).depth, step * TOY_ANGLE_STEP)
