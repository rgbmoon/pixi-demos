import type { RasterImage, Rgb } from '#src/types'

import { createImage, getOffset, isOpaque } from './image'

const SIDE_NEIGHBORS = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
] as const

const DIAGONAL_NEIGHBORS = [...SIDE_NEIGHBORS, [-1, -1], [1, -1], [-1, 1], [1, 1]] as const

/**
 * Контур толщиной 1 px вокруг непрозрачных пикселей. Растр на 1 px шире исходного с каждой стороны, закрашены
 * только пиксели контура: прозрачные пиксели исходника, у которых есть непрозрачный сосед по стороне,
 * а с `diagonal` — и по диагонали.
 */
export const outlineImage = (image: RasterImage, color: Rgb, diagonal = false): RasterImage => {
  const result = createImage(image.width + 2, image.height + 2)
  const neighbors = diagonal ? DIAGONAL_NEIGHBORS : SIDE_NEIGHBORS

  for (let y = 0; y < result.height; y++) {
    for (let x = 0; x < result.width; x++) {
      const sourceX = x - 1
      const sourceY = y - 1

      if (isOpaque(image, sourceX, sourceY)) continue
      if (!neighbors.some(([dx, dy]) => isOpaque(image, sourceX + dx, sourceY + dy))) continue

      result.data.set([...color, 255], getOffset(result, x, y))
    }
  }

  return result
}

/** Имя кадра контура: `-outline` перед номером кадра, чтобы кадры контура собрались в свою анимацию. */
export const getOutlineName = (name: string): string => name.replace(/^(.*?)([-_]?\d+)?$/, '$1-outline$2')
