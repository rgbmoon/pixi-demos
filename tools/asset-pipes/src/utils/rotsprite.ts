import { ROTSPRITE_PRECISION, ROTSPRITE_SCALE } from '#src/constants'
import type { RasterImage, RasterPoint } from '#src/types'

import { createImage, getColor, setColor } from './image'

/**
 * Увеличивает растр вдвое по правилам Scale2x (EPX): ступенька диагонали достраивается цветом соседей,
 * новых цветов не появляется.
 */
export const scale2x = (image: RasterImage): RasterImage => {
  const result = createImage(image.width * 2, image.height * 2)

  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const center = getColor(image, x, y)
      const up = getColor(image, x, y - 1)
      const left = getColor(image, x - 1, y)
      const right = getColor(image, x + 1, y)
      const down = getColor(image, x, y + 1)

      setColor(result, x * 2, y * 2, left === up && up !== right && left !== down ? left : center)
      setColor(result, x * 2 + 1, y * 2, up === right && up !== left && right !== down ? right : center)
      setColor(result, x * 2, y * 2 + 1, left === down && left !== up && down !== right ? left : center)
      setColor(result, x * 2 + 1, y * 2 + 1, down === right && left !== down && up !== right ? right : center)
    }
  }

  return result
}

/** Растр, увеличенный для RotSprite: три прохода Scale2x. */
export const upscaleForRotation = (image: RasterImage): RasterImage => scale2x(scale2x(scale2x(image)))

const roundEdge = (value: number): number => Number(value.toFixed(ROTSPRITE_PRECISION))

/**
 * Кадр поворота RotSprite на `degrees` по часовой стрелке вокруг опорной точки. Центр каждого пикселя кадра
 * переводится обратным поворотом в исходный растр и получает цвет увеличенного растра `upscaled` без сглаживания.
 * Сетка кадра совпадает с сеткой исходника, поэтому опорная точка во всех кадрах лежит в одной доле пикселя.
 */
export const rotateSprite = (
  image: RasterImage,
  upscaled: RasterImage,
  degrees: number,
  pivot: RasterPoint
): { image: RasterImage; pivot: RasterPoint } => {
  const radians = (degrees * Math.PI) / 180
  const cos = roundEdge(Math.cos(radians))
  const sin = roundEdge(Math.sin(radians))
  const corners = [
    { x: 0, y: 0 },
    { x: image.width, y: 0 },
    { x: 0, y: image.height },
    { x: image.width, y: image.height },
  ].map(({ x, y }) => ({
    x: roundEdge(pivot.x + (x - pivot.x) * cos - (y - pivot.y) * sin),
    y: roundEdge(pivot.y + (x - pivot.x) * sin + (y - pivot.y) * cos),
  }))
  const left = Math.floor(Math.min(...corners.map(({ x }) => x)))
  const top = Math.floor(Math.min(...corners.map(({ y }) => y)))
  const result = createImage(
    Math.ceil(Math.max(...corners.map(({ x }) => x))) - left,
    Math.ceil(Math.max(...corners.map(({ y }) => y))) - top
  )

  for (let y = 0; y < result.height; y++) {
    for (let x = 0; x < result.width; x++) {
      const dx = left + x + 0.5 - pivot.x
      const dy = top + y + 0.5 - pivot.y
      const sourceX = pivot.x + dx * cos + dy * sin
      const sourceY = pivot.y - dx * sin + dy * cos
      // Центр пикселя увеличенного растра сохраняет цвет исходника: на 0° и 90° поворот переставляет пиксели точно
      setColor(
        result,
        x,
        y,
        getColor(upscaled, Math.floor(sourceX * ROTSPRITE_SCALE), Math.floor(sourceY * ROTSPRITE_SCALE))
      )
    }
  }

  return { image: result, pivot: { x: pivot.x - left, y: pivot.y - top } }
}
