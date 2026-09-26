import type { RasterImage, RasterPoint, ShearSlopes } from '#src/types'

import { createImage, getOffset } from './image'

/**
 * Сдвиг столбца или строки с номером `index` при наклоне `slope`: смещение центра пикселя, округлённое до целого.
 * Нулевой столбец и нулевая строка не сдвигаются.
 */
export const getShearOffset = (index: number, slope: number): number =>
  Math.round((index + 0.5) * slope) - Math.round(0.5 * slope)

const getRange = (count: number, offsetAt: (index: number) => number): { min: number; max: number } => {
  let min = 0
  let max = 0

  for (let index = 0; index < count; index++) {
    min = Math.min(min, offsetAt(index))
    max = Math.max(max, offsetAt(index))
  }

  return { min, max }
}

/**
 * Переводит прямоугольный растр грани в проекцию игры: сначала строки сдвигаются по горизонтали, затем столбцы
 * по вертикали. Каждый проход переставляет пиксели без потерь и повторов. Растр растёт на размах сдвигов,
 * `origin` — куда попал левый верхний угол исходного растра.
 */
export const shearImage = (image: RasterImage, slopes: ShearSlopes): { image: RasterImage; origin: RasterPoint } => {
  const rows = getRange(image.height, (y) => getShearOffset(y, slopes.row))
  const rowShiftedWidth = image.width + rows.max - rows.min
  // Сдвиг столбца считается от исходного левого края: после прохода строк он стоит в столбце -rows.min
  const columns = getRange(rowShiftedWidth, (x) => getShearOffset(x + rows.min, slopes.column))
  const result = createImage(rowShiftedWidth, image.height + columns.max - columns.min)

  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const shiftedX = x + getShearOffset(y, slopes.row) - rows.min
      const shiftedY = y + getShearOffset(shiftedX + rows.min, slopes.column) - columns.min
      const source = getOffset(image, x, y)

      result.data.set(image.data.subarray(source, source + 4), getOffset(result, shiftedX, shiftedY))
    }
  }

  return { image: result, origin: { x: -rows.min, y: -columns.min } }
}

/** Переносит точку исходного растра в растр после `shearImage` по сдвигам пикселя, в котором она лежит. */
export const shearPoint = (point: RasterPoint, slopes: ShearSlopes, origin: RasterPoint): RasterPoint => {
  const x = point.x + getShearOffset(Math.floor(point.y), slopes.row) + origin.x

  return { x, y: point.y + getShearOffset(Math.floor(x - origin.x), slopes.column) + origin.y }
}
