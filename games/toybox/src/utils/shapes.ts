import { PRIZE_NICHE_FLOOR, TOY_ANGLE_STEP, TOY_ANGLE_STEPS, TOY_CONTACT_SHARE, TOY_INSET } from '#src/constants'
import { TOY_SPECS } from '#src/toy-specs'
import type { PlaneVector, ScreenPoint, SectionPoint, ToyKey, ToyPose, WorldPoint } from '#src/types'

import { getConvexHull, getSignedArea } from './geometry'
import { worldToScreen } from './projection'

/** Вес игрушки: от него зависят шанс захвата и масса тела. */
export const getWeight = (toy: ToyKey): number => TOY_SPECS[toy].weight

/** Глубина игрушки в срезах. */
export const getDepth = (toy: ToyKey): number => TOY_SPECS[toy].depth

/** Сечение тела игрушки относительно опорной точки, без крена: выпуклая оболочка её арта. */
export const getSection = (toy: ToyKey): readonly SectionPoint[] => TOY_SPECS[toy].section

/** Сечение, которым игрушка касается других игрушек: полное сечение, сжатое к опорной точке. */
export const getContactSection = (toy: ToyKey): SectionPoint[] =>
  getSection(toy).map(({ y, z }) => ({ y: y * TOY_CONTACT_SHARE, z: z * TOY_CONTACT_SHARE }))

/** Площадь выпуклого сечения. */
export const getSectionArea = (section: readonly SectionPoint[]): number => Math.abs(getSignedArea(toPlane(section)))

/** Наибольшие отступы сечения от центра по осям. */
export const getSectionExtent = (section: readonly SectionPoint[]): { halfWidth: number; halfHeight: number } => ({
  halfWidth: Math.max(...section.map(({ y }) => Math.abs(y))),
  halfHeight: Math.max(...section.map(({ z }) => Math.abs(z))),
})

/** Центр приза без крена, стоящего на полу ниши окна выдачи. */
export const getPrizeSeat = (toy: ToyKey): WorldPoint => {
  const bottom = Math.min(...getSection(toy).map(({ z }) => z))

  return { ...PRIZE_NICHE_FLOOR, z: PRIZE_NICHE_FLOOR.z - bottom }
}

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

/** Номер шага угла, ближайшего к крену: по нему выбирается кадр крена. */
export const getAngleStep = (angle: number): number =>
  ((Math.round(angle / TOY_ANGLE_STEP) % TOY_ANGLE_STEPS) + TOY_ANGLE_STEPS) % TOY_ANGLE_STEPS
