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
  readonly hasLamp?: boolean
  /** Ближний срез глубины; игрушка занимает срезы от него на глубину своего положения. */
  slab: number
  /** Центр игрушки в мировых координатах и крен. */
  pose: { point: WorldPoint; angle: number }
  state: ToyState
}

/** Биты фильтра столкновений фикстуры: её категории и категории, с которыми она сталкивается. */
export type CollisionFilter = {
  readonly category: number
  readonly mask: number
}

/** Попадание луча, пущенного вниз: игрушка, в которую он упёрся, и высота точки. */
export type SurfaceHit = {
  id: ToyId | undefined
  z: number
}

/** Неподвижный прямоугольник мира в плоскости `(y, z)`: центр, размеры и срезы, с игрушками которых он сталкивается. */
export type StaticBox = {
  readonly y: number
  readonly z: number
  readonly width: number
  readonly height: number
  readonly mask: number
}

/** Статика мира кучи: пол и стенки. */
export type WorldStatics = {
  readonly boxes: readonly StaticBox[]
  /** Граница срезов со стенкой, в которую упирается только игрушка, занимающая срезы по обе стороны от неё. */
  readonly spanEdge?: number
}

/** Пределы игрушки в снимке: число срезов и рамка центра в плоскости `(y, z)`. */
export type SnapshotBounds = {
  readonly slabs: number
  readonly minY: number
  readonly maxY: number
  readonly minZ: number
  readonly maxZ: number
}
