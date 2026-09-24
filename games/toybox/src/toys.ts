import type { Shape, ShapeKey } from '#src/types'

/**
 * Каталог форм: сечения в плоскости `(y, z)` в клетках — выпуклые многоугольники со скруглёнными углами,
 * глубина в срезах, вес в клетках и частота при наполнении. Скругление приближает силуэты к упрощённым
 * мягким игрушкам; габариты и веса форм соответствуют прежним клеточным формам.
 */
export const SHAPES: Record<ShapeKey, Shape> = {
  single: {
    variants: [
      {
        section: [
          { y: -0.5, z: -0.45 },
          { y: 0.5, z: -0.45 },
          { y: 0.5, z: 0.45 },
          { y: -0.5, z: 0.45 },
        ],
        radius: 0.4,
        depth: 1,
      },
    ],
    weight: 1,
    fillWeight: 2,
  },
  bar2: {
    variants: [
      {
        section: [
          { y: -1, z: -0.5 },
          { y: 1, z: -0.5 },
          { y: 1, z: 0.5 },
          { y: -1, z: 0.5 },
        ],
        radius: 0.45,
        depth: 1,
      },
      {
        section: [
          { y: -0.5, z: -0.5 },
          { y: 0.5, z: -0.5 },
          { y: 0.5, z: 0.5 },
          { y: -0.5, z: 0.5 },
        ],
        radius: 0.42,
        depth: 2,
      },
    ],
    weight: 2,
    fillWeight: 7,
  },
  square4: {
    variants: [
      {
        section: [
          { y: -1, z: -0.5 },
          { y: 1, z: -0.5 },
          { y: 1, z: 0.5 },
          { y: -1, z: 0.5 },
        ],
        radius: 0.3,
        depth: 2,
      },
    ],
    weight: 4,
    fillWeight: 6,
  },
  cube8: {
    variants: [
      {
        section: [
          { y: -1, z: -1 },
          { y: 1, z: -1 },
          { y: 0.85, z: 1 },
          { y: -0.85, z: 1 },
        ],
        radius: 0.55,
        depth: 2,
      },
    ],
    weight: 8,
    fillWeight: 3,
  },
  triangle: {
    variants: [
      {
        section: [
          { y: -1, z: -0.5 },
          { y: 1, z: -0.5 },
          { y: 0, z: 1 },
        ],
        radius: 0.35,
        depth: 2,
      },
    ],
    weight: 3,
    fillWeight: 4,
  },
}

/** Ключи каталога для перебора при наполнении. */
export const SHAPE_KEYS = Object.keys(SHAPES) as ShapeKey[]
