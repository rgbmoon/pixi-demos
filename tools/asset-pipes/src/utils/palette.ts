import { ALPHA_THRESHOLD } from '#src/constants'
import type { AlphaMode, Lab, Palette, PaletteEntry, PaletteIndex, RasterImage, Rgb } from '#src/types'

import { createImage } from './image'

/** Разбирает цвет `#rrggbb`. */
export const parseHex = (hex: string): Rgb => {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)

  if (!match) throw new Error(`Invalid color "${hex}": expected #rrggbb`)

  const value = parseInt(match[1], 16)

  return [value >> 16, (value >> 8) & 0xff, value & 0xff]
}

/** Режим альфы по тегу: без тега — `binary`, `{alpha}` — `keep`, `{alpha=0.4}` — одна непрозрачность 0.4. */
export const toAlphaMode = (tag: unknown): AlphaMode => {
  if (tag === undefined) return 'binary'
  if (tag === true) return 'keep'
  if (typeof tag === 'number' && tag >= 0 && tag <= 1) return tag

  throw new Error(`{alpha=${String(tag)}}: expected a number from 0 to 1`)
}

/** Упаковывает RGB в одно число: ключ поиска цвета. */
const packRgb = ([red, green, blue]: Rgb): number => (red << 16) | (green << 8) | blue

const toLinear = (channel: number): number => {
  const value = channel / 255

  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

/** Переводит цвет sRGB в OKLab. */
export const toOklab = ([red, green, blue]: Rgb): Lab => {
  const r = toLinear(red)
  const g = toLinear(green)
  const b = toLinear(blue)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

const getDistance = (a: Lab, b: Lab): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** Раскладывает палитру для поиска; палитра с рампами разной длины или повтором цвета отклоняется. */
export const indexPalette = (palette: Palette): PaletteIndex => {
  const rampEntries = Object.entries(palette.ramps)
  const steps = rampEntries[0]?.[1].length

  if (!steps) throw new Error('Palette has no colors')

  const ramps: Record<string, PaletteEntry[]> = {}
  const byColor = new Map<number, PaletteEntry>()

  for (const [ramp, colors] of rampEntries) {
    if (colors.length !== steps) throw new Error(`Ramp "${ramp}" has ${colors.length} steps, expected ${steps}`)

    ramps[ramp] = colors.map((hex, step) => {
      const rgb = parseHex(hex)
      const entry: PaletteEntry = { ramp, step, rgb, lab: toOklab(rgb) }

      if (byColor.has(packRgb(rgb))) throw new Error(`Color ${hex} appears in the palette twice`)

      byColor.set(packRgb(rgb), entry)

      return entry
    })
  }

  return { entries: Object.values(ramps).flat(), byColor, ramps }
}

/** Проверяет, что у палитр одинаковые рампы и число ступеней: только тогда цвет переводится по адресу. */
export const assertSameStructure = (source: PaletteIndex, target: PaletteIndex): void => {
  for (const [ramp, entries] of Object.entries(source.ramps)) {
    if (target.ramps[ramp]?.length !== entries.length) {
      throw new Error(`Target palette has no ramp "${ramp}" with ${entries.length} steps`)
    }
  }
}

/** Ближайший по OKLab цвет палитры. */
const findNearest = (index: PaletteIndex, rgb: Rgb): PaletteEntry => {
  const lab = toOklab(rgb)
  let nearest = index.entries[0]
  let nearestDistance = Infinity

  for (const entry of index.entries) {
    const distance = getDistance(lab, entry.lab)

    if (distance < nearestDistance) {
      nearest = entry
      nearestDistance = distance
    }
  }

  return nearest
}

/**
 * Приводит растр к палитре: каждый видимый пиксель получает ближайший по OKLab цвет, без дизеринга.
 * Прозрачный пиксель становится `(0, 0, 0, 0)`. `outside` — число видимых пикселей, чей цвет не входил в палитру.
 */
export const quantizeImage = (
  image: RasterImage,
  index: PaletteIndex,
  alpha: AlphaMode
): { image: RasterImage; outside: number } => {
  const result = createImage(image.width, image.height)
  const cache = new Map<number, PaletteEntry>()
  let outside = 0

  for (let offset = 0; offset < image.data.length; offset += 4) {
    const sourceAlpha = image.data[offset + 3]
    const visible = alpha === 'keep' ? sourceAlpha > 0 : sourceAlpha >= ALPHA_THRESHOLD

    if (!visible) continue

    const rgb: Rgb = [image.data[offset], image.data[offset + 1], image.data[offset + 2]]
    const key = packRgb(rgb)
    let entry = index.byColor.get(key)

    if (!entry) {
      outside += 1
      entry = cache.get(key) ?? findNearest(index, rgb)
      cache.set(key, entry)
    }

    result.data.set(entry.rgb, offset)

    if (alpha === 'binary') result.data[offset + 3] = 255
    else if (alpha === 'keep') result.data[offset + 3] = sourceAlpha
    else result.data[offset + 3] = Math.round(alpha * 255)
  }

  return { image: result, outside }
}

/**
 * Заменяет цвет каждого пикселя палитры цветом, который `pick` выбирает по его адресу.
 * Пиксели вне палитры и прозрачные остаются как есть.
 */
const mapEntries = (
  image: RasterImage,
  index: PaletteIndex,
  pick: (entry: PaletteEntry) => PaletteEntry
): RasterImage => {
  const result: RasterImage = { width: image.width, height: image.height, data: image.data.slice() }

  for (let offset = 0; offset < result.data.length; offset += 4) {
    if (result.data[offset + 3] === 0) continue

    const entry = index.byColor.get(packRgb([result.data[offset], result.data[offset + 1], result.data[offset + 2]]))

    if (entry) result.data.set(pick(entry).rgb, offset)
  }

  return result
}

/** Переводит растр из цветов `source` в цвета `target` той же структуры: рампа и ступень сохраняются. */
export const remapImage = (image: RasterImage, source: PaletteIndex, target: PaletteIndex): RasterImage =>
  mapEntries(image, source, ({ ramp, step }) => target.ramps[ramp][step])

/**
 * Сдвигает ступень каждого пикселя внутри его рампы: `shift` < 0 — темнее, > 0 — светлее. Сдвиг останавливается
 * на крайней ступени.
 */
export const shiftSteps = (image: RasterImage, index: PaletteIndex, shift: number): RasterImage =>
  mapEntries(image, index, ({ ramp, step }) => {
    const entries = index.ramps[ramp]

    return entries[Math.min(entries.length - 1, Math.max(0, step + shift))]
  })

/** Кадр цикла цветов: ступень пикселя сдвигается на `frame` по кругу внутри рампы; без `ramps` — во всех рампах. */
export const cycleSteps = (
  image: RasterImage,
  index: PaletteIndex,
  frame: number,
  ramps?: readonly string[]
): RasterImage =>
  mapEntries(image, index, (entry) => {
    if (ramps && !ramps.includes(entry.ramp)) return entry

    const entries = index.ramps[entry.ramp]

    return entries[(entry.step + frame) % entries.length]
  })
