import type { FrameBorders, RasterImage } from '#src/types'

import { getColor } from './image'

/** Одного ли цвета пиксели прямоугольника вдоль оси растяжения: строки при `axis` = `x`, столбцы при `y`. */
const isUniformAlong = (
  image: RasterImage,
  axis: 'x' | 'y',
  left: number,
  top: number,
  right: number,
  bottom: number
): boolean => {
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const first = axis === 'x' ? getColor(image, left, y) : getColor(image, x, top)

      if (getColor(image, x, y) !== first) return false
    }
  }

  return true
}

/**
 * Части кадра 9-slice, которые меняются вдоль направления растяжения: `NineSliceSprite` растягивает кромки
 * вдоль края, а центр — по обеим осям, и неоднородная часть растянется с дробным пикселем.
 */
export const findNonUniformBands = (image: RasterImage, borders: FrameBorders): string[] => {
  const right = image.width - borders.right
  const bottom = image.height - borders.bottom
  const bands: [string, boolean][] = [
    ['top', isUniformAlong(image, 'x', borders.left, 0, right, borders.top)],
    ['bottom', isUniformAlong(image, 'x', borders.left, bottom, right, image.height)],
    ['left', isUniformAlong(image, 'y', 0, borders.top, borders.left, bottom)],
    ['right', isUniformAlong(image, 'y', right, borders.top, image.width, bottom)],
    [
      'center',
      isUniformAlong(image, 'x', borders.left, borders.top, right, bottom) &&
        isUniformAlong(image, 'y', borders.left, borders.top, right, bottom),
    ],
  ]

  return bands.filter(([, uniform]) => !uniform).map(([name]) => name)
}
