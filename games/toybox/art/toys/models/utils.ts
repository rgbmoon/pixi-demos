import type { ModelPart, ModelVector } from '@pixi-demos/asset-pipes/types'
import { isInEllipse, isOnSegment } from '@pixi-demos/asset-pipes/utils/model'

/** Материал части: рампа, ступень света, контура и шва. */
export type Material = Pick<ModelPart, 'ramp' | 'base' | 'outline' | 'seam'>

/** Пятно детали: центр и полуоси эллипса в пикселях эскиза. */
export type Spot = readonly [a: number, b: number, ra: number, rb: number]

/** Ткань: контур — самая тёмная ступень рампы, шов со своей рампой — следующая. */
export const fabric = (ramp: string, base = 2): Material => ({ ramp, base, outline: 0, seam: 1 })

/** Часть без шва с соседними частями той же рампы: пластик, резина, вставка другой ткани. */
export const seamless = (ramp: string, base = 2): Material => ({ ramp, base, outline: 0 })

/**
 * Наименьший радиус точки и толщина линии детали, px арта. Круг радиуса не меньше √2 / 2 и полоса шириной не меньше
 * пикселя накрывают центр хотя бы одного пикселя при любом крене: деталь не пропадает между кадрами.
 */
const MIN_DOT_RADIUS = Math.SQRT1_2
const MIN_LINE_WIDTH = 1

/** Набивка, торчащая из разрыва. */
export const STUFFING: Material = { ramp: 'bone', base: 4, outline: 2 }

/**
 * Набор построения модели: части и проверки деталей поверхности в пикселях эскиза, растянутых на `scale`. Масштаб
 * задаёт размер игрушки, толщина линий деталей задана в пикселях арта и от него не зависит.
 */
export const createKit = (scale: number) => {
  const scaled = ([a, b, d]: ModelVector): ModelVector => [a * scale, b * scale, d * scale]
  const near = (a: number, b: number, ca: number, cb: number, ra: number, rb: number): boolean =>
    isInEllipse(
      a,
      b,
      [ca * scale, cb * scale],
      [Math.max(ra * scale, MIN_DOT_RADIUS), Math.max(rb * scale, MIN_DOT_RADIUS)]
    )
  const onSegment = (a: number, b: number, a1: number, b1: number, a2: number, b2: number, width: number): boolean =>
    isOnSegment(a, b, [a1 * scale, b1 * scale], [a2 * scale, b2 * scale], Math.max(width, MIN_LINE_WIDTH))

  return {
    scale,
    part: (name: string, group: string, center: ModelVector, radii: ModelVector, material: Material): ModelPart => ({
      name,
      group,
      center: scaled(center),
      radii: scaled(radii),
      ...material,
    }),
    /** Цепочка шариков радиуса `radius` по ломаной: тонкие ноги, щупальца, хвост. */
    chain: (
      name: string,
      group: string,
      points: readonly ModelVector[],
      radius: number,
      material: Material
    ): ModelPart[] =>
      points.slice(1).flatMap((to, index) => {
        const from = points[index]
        const count = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]) / radius))

        return Array.from({ length: index === 0 ? count + 1 : count }, (_, step): ModelPart => {
          const t = (index === 0 ? step : step + 1) / count
          const center: ModelVector = [
            from[0] + (to[0] - from[0]) * t,
            from[1] + (to[1] - from[1]) * t,
            from[2] + (to[2] - from[2]) * t,
          ]

          return { name, group, center: scaled(center), radii: scaled([radius, radius, radius]), ...material }
        })
      }),
    near,
    onSegment,
    /** Крестик со сторонами `size` и толщиной линии `width`: глаз-крестик, стежок. */
    cross: (a: number, b: number, ca: number, cb: number, size = 1.4, width = 1.05): boolean =>
      onSegment(a, b, ca - size, cb - size, ca + size, cb + size, width) ||
      onSegment(a, b, ca - size, cb + size, ca + size, cb - size, width),
    /** Лежит ли точка в одном из пятен. */
    inSpots: (a: number, b: number, spots: readonly Spot[]): boolean =>
      spots.some(([ca, cb, ra, rb]) => near(a, b, ca, cb, ra, rb)),
  }
}
