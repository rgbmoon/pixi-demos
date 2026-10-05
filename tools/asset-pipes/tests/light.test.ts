import { describe, expect, it } from 'vitest'

import type { RasterImage } from '#src/types'
import { getOffset } from '#src/utils/image'
import { renderLight } from '#src/utils/light'

/** Цвета рампы пятна от тусклого к яркому. */
const COLORS = [
  [40, 0, 60],
  [120, 0, 120],
  [240, 30, 160],
] as const

const isLit = (image: RasterImage, x: number, y: number): boolean => image.data[getOffset(image, x, y) + 3] > 0

const getColor = (image: RasterImage, x: number, y: number): number[] => [
  ...image.data.subarray(getOffset(image, x, y), getOffset(image, x, y) + 3),
]

describe('пайп light', () => {
  it('светит источником-прямоугольником в полную силу по всей его площади', () => {
    const image = renderLight(
      {
        width: 40,
        height: 30,
        center: { x: 20, y: 15 },
        source: { width: 16, height: 10 },
        radius: 8,
        ramp: 'neon',
        steps: [0, 2],
      },
      COLORS
    )

    for (let y = 10; y < 20; y++) {
      for (let x = 12; x < 28; x++) expect(getColor(image, x, y)).toEqual([...COLORS[2]])
    }
  })

  it('гасит свет над источником на радиусе top и ведёт его вниз до радиуса bottom', () => {
    const image = renderLight(
      {
        width: 20,
        height: 60,
        center: { x: 10, y: 20 },
        source: { width: 4, height: 4 },
        radius: { x: 6, top: 2, bottom: 30 },
        ramp: 'neon',
        steps: [0, 2],
      },
      COLORS
    )

    // Источник занимает строки 18–21: пять строк выше и ниже его краёв
    expect(isLit(image, 10, 13)).toBe(false)
    expect(isLit(image, 10, 26)).toBe(true)
  })
})
