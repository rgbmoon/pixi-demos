import type { GroundPoint, ShapeKey, ToyId, WorldPoint } from '#src/types'

/** Профиль купола для наполнения: пик на полу, крутизна склона и расстояние от пика до дальнего угла. */
export type DomeProfile = {
  readonly peak: GroundPoint
  readonly falloff: number
  readonly reach: number
}

/** Что с игрушкой происходит сейчас: от этого зависит, сталкивается ли она с кучей. */
export const ToyState = {
  /** Лежит в куче или движется по ней. */
  free: 'free',
  /** Висит в клешне и повторяет точку захвата. */
  carried: 'carried',
  /** Падает в шахту лотка без столкновений. */
  exiting: 'exiting',
} as const

export type ToyState = (typeof ToyState)[keyof typeof ToyState]

/** Игрушка в модели кучи: форма, срезы глубины и непрерывная поза, которой её рисуют. */
export type ToyBody = {
  readonly id: ToyId
  readonly shape: ShapeKey
  readonly variant: number
  readonly color: number
  /** Ближний срез глубины; игрушка занимает срезы от него на глубину своего положения. */
  slab: number
  /** Центр игрушки в мировых координатах и крен. */
  pose: { point: WorldPoint; angle: number }
  state: ToyState
}

/** Биты фильтра столкновений фикстуры: её категории и категории, с которыми она сталкивается. */
export type CollisionFilter = {
  readonly filterCategoryBits: number
  readonly filterMaskBits: number
}

/** Попадание луча, пущенного вниз: игрушка, в которую он упёрся, и высота точки. */
export type SurfaceHit = {
  id: ToyId | undefined
  z: number
}
