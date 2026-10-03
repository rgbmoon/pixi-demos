import { SOFTEN_RADIUS } from '#src/constants'
import type { Palette, RasterImage, Rgb } from '#src/types'

import { createImage, getColor, getOffset, isOpaque, setColor } from './image'
import { parseHex } from './palette'

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

/** Непрозрачный цвет `#rrggbb` в упаковке `getColor`. */
const toColor = (hex: string): number => {
  const [red, green, blue] = parseHex(hex)

  return ((red << 24) | (green << 16) | (blue << 8) | 0xff) >>> 0
}

/**
 * Смягчает самый тёмный цвет `darkest`: его пиксели на краю силуэта получают цвет `edge`, остальные — нижнюю ступень
 * рампы, которой принадлежит большинство соседей в радиусе до `SOFTEN_RADIUS`. Пиксель без таких соседей получает
 * `edge`.
 */
export const softenDarkest = (image: RasterImage, palette: Palette, darkest: string, edge: string): RasterImage => {
  const result: RasterImage = { width: image.width, height: image.height, data: new Uint8Array(image.data) }
  const target = toColor(darkest)
  const edgeColor = toColor(edge)
  const rampOf = new Map(
    Object.entries(palette.ramps).flatMap(([ramp, colors]) => colors.map((hex) => [toColor(hex), ramp] as const))
  )

  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (getColor(image, x, y) !== target) continue

      let color = edgeColor

      if (SIDE_NEIGHBORS.every(([dx, dy]) => isOpaque(image, x + dx, y + dy))) {
        for (let radius = 1; radius <= SOFTEN_RADIUS; radius++) {
          const votes = new Map<string, number>()

          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const neighbor = getColor(image, x + dx, y + dy)
              const ramp = neighbor === target ? undefined : rampOf.get(neighbor)

              if (ramp) votes.set(ramp, (votes.get(ramp) ?? 0) + 1)
            }
          }

          if (votes.size === 0) continue

          const [ramp] = [...votes].reduce((best, vote) => (vote[1] > best[1] ? vote : best))

          color = toColor(palette.ramps[ramp][0])
          break
        }
      }

      setColor(result, x, y, color)
    }
  }

  return result
}
