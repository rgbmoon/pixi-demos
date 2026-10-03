import { DOWNSCALE_COVERAGE } from '#src/constants'
import type { Lab, RasterImage, Rgb } from '#src/types'

import { createImage, getOffset, isOpaque } from './image'
import { toOklab } from './palette'

/** Непрозрачный пиксель исходника под пикселем результата: цвет, доля площади и лежит ли он на краю силуэта. */
type Sample = { rgb: Rgb; lab: Lab; weight: number; edge: boolean }

const isEdge = (image: RasterImage, x: number, y: number): boolean =>
  !isOpaque(image, x - 1, y) || !isOpaque(image, x + 1, y) || !isOpaque(image, x, y - 1) || !isOpaque(image, x, y + 1)

const getDistance = (a: Lab, b: Lab): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** Самый тёмный по OKLab образец. */
const getDarkest = (samples: readonly Sample[]): Sample =>
  samples.reduce((darkest, sample) => (sample.lab[0] < darkest.lab[0] ? sample : darkest))

/** Цвет, ближе всех к остальным с учётом площади: новых цветов уменьшение не создаёт. */
const getMedoid = (samples: readonly Sample[]): Sample => {
  let best = samples[0]
  let bestCost = Infinity

  for (const candidate of samples) {
    const cost = samples.reduce((sum, sample) => sum + sample.weight * getDistance(candidate.lab, sample.lab), 0)

    if (cost < bestCost) {
      best = candidate
      bestCost = cost
    }
  }

  return best
}

/**
 * Уменьшает пиксель-арт в `scale` раз (меньше 1). Пиксель результата непрозрачен, если под ним не меньше
 * `DOWNSCALE_COVERAGE` площади исходника, и берёт цвет исходника, ближайший к остальным цветам под ним. Пиксели края
 * силуэта берут самый тёмный цвет края исходника: контур остаётся сплошным.
 */
export const downscaleImage = (image: RasterImage, scale: number): RasterImage => {
  const result = createImage(Math.round(image.width * scale), Math.round(image.height * scale))
  const footprints: Sample[][] = []

  for (let y = 0; y < result.height; y++) {
    for (let x = 0; x < result.width; x++) {
      const left = x / scale
      const right = (x + 1) / scale
      const top = y / scale
      const bottom = (y + 1) / scale
      const samples: Sample[] = []

      for (let sourceY = Math.floor(top); sourceY < Math.ceil(bottom); sourceY++) {
        for (let sourceX = Math.floor(left); sourceX < Math.ceil(right); sourceX++) {
          if (!isOpaque(image, sourceX, sourceY)) continue

          const offset = getOffset(image, sourceX, sourceY)
          const rgb: Rgb = [image.data[offset], image.data[offset + 1], image.data[offset + 2]]
          const weight =
            (Math.min(sourceX + 1, right) - Math.max(sourceX, left)) *
            (Math.min(sourceY + 1, bottom) - Math.max(sourceY, top))

          samples.push({ rgb, lab: toOklab(rgb), weight, edge: isEdge(image, sourceX, sourceY) })
        }
      }

      const coverage = samples.reduce((sum, { weight }) => sum + weight, 0) * scale * scale

      footprints.push(samples)
      if (coverage >= DOWNSCALE_COVERAGE) result.data.set([...getMedoid(samples).rgb, 255], getOffset(result, x, y))
    }
  }

  // Край ищется по готовому силуэту: перекраска края силуэт не меняет
  const edges = Array.from({ length: result.width * result.height }, (_, index) => index).filter((index) => {
    const x = index % result.width
    const y = Math.floor(index / result.width)

    return isOpaque(result, x, y) && isEdge(result, x, y)
  })

  for (const index of edges) {
    const samples = footprints[index]
    const outline = samples.filter(({ edge }) => edge)

    result.data.set(getDarkest(outline.length > 0 ? outline : samples).rgb, index * 4)
  }

  return result
}
