import type { RasterImage } from '#src/types'

import { getOffset } from './image'

const MAX_DIFFERENCE = Math.hypot(255, 255, 255, 255)

const getPixelDifference = (image: RasterImage, first: number, second: number): number =>
  Math.hypot(
    image.data[first] - image.data[second],
    image.data[first + 1] - image.data[second + 1],
    image.data[first + 2] - image.data[second + 2],
    image.data[first + 3] - image.data[second + 3]
  ) / MAX_DIFFERENCE

/**
 * Резкость шва тайла по оси: средняя разница пикселей на стыке последнего и первого столбца (строки), делённая
 * на среднюю разницу соседних столбцов (строк) внутри тайла. У бесшовного тайла стык не резче остальных переходов,
 * и значение около 1 или меньше.
 */
export const measureSeam = (image: RasterImage, axis: 'x' | 'y'): number => {
  const length = axis === 'x' ? image.width : image.height
  const across = axis === 'x' ? image.height : image.width
  const pixelAt = (line: number, index: number): number =>
    axis === 'x' ? getOffset(image, line, index) : getOffset(image, index, line)
  const getLineDifference = (first: number, second: number): number => {
    let sum = 0

    for (let index = 0; index < across; index++)
      sum += getPixelDifference(image, pixelAt(first, index), pixelAt(second, index))

    return sum / across
  }

  if (length < 2) return 0

  const seam = getLineDifference(length - 1, 0)
  let interior = 0

  for (let line = 0; line < length - 1; line++) interior += getLineDifference(line, line + 1)

  interior /= length - 1

  if (interior === 0) return seam === 0 ? 0 : Infinity

  return seam / interior
}
