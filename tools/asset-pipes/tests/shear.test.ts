import { describe, expect, it } from 'vitest'

import type { ShearSlopes } from '#src/types'
import { createImage } from '#src/utils/image'
import { shearImage } from '#src/utils/shear'

import { getVisibleColors } from './setup/raster'

/** Наклоны фасада, бока и наклонной панели toybox. */
const SLOPES: ShearSlopes[] = [
  { column: 1 / 16, row: 0 },
  { column: -1, row: 0 },
  { column: 1 / 16, row: -6 / 22 },
]

/** Растр, у каждого пикселя которого свой цвет. */
const createUniqueColors = (width: number, height: number): ReturnType<typeof createImage> => {
  const image = createImage(width, height)

  for (let pixel = 0; pixel < width * height; pixel++) image.data.set([pixel & 0xff, pixel >> 8, 7, 255], pixel * 4)

  return image
}

describe('пайп projection', () => {
  it('переставляет пиксели грани без потерь и повторов', () => {
    const image = createUniqueColors(48, 30)

    for (const slopes of SLOPES) {
      const { image: result } = shearImage(image, slopes)

      expect(getVisibleColors(result).sort()).toEqual(getVisibleColors(image).sort())
    }
  })

  it('оставляет левый верхний угол рисунка в точке origin', () => {
    const image = createUniqueColors(48, 30)

    for (const slopes of SLOPES) {
      const { image: result, origin } = shearImage(image, slopes)
      const offset = (origin.y * result.width + origin.x) * 4

      expect(Array.from(result.data.subarray(offset, offset + 4))).toEqual(Array.from(image.data.subarray(0, 4)))
    }
  })
})
