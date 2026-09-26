import { describe, expect, it } from 'vitest'

import type { Palette } from '#src/types'
import { createImage } from '#src/utils/image'
import { indexPalette, parseHex, quantizeImage, remapImage, shiftSteps } from '#src/utils/palette'

import { fromRows, toRows } from './setup/raster'

const PALETTE: Palette = {
  ramps: {
    neon: ['#41107a', '#a50e7b', '#f97f96'],
    metal: ['#2b2a44', '#746b91', '#f0cdef'],
  },
}

/** Палитра той же структуры с другими цветами. */
const TARGET: Palette = {
  ramps: {
    neon: ['#1c3422', '#6e7c40', '#cec691'],
    metal: ['#2e1916', '#714a39', '#a99079'],
  },
}

const LEGEND = {
  a: PALETTE.ramps.neon[0],
  b: PALETTE.ramps.neon[1],
  c: PALETTE.ramps.neon[2],
  x: PALETTE.ramps.metal[0],
  y: PALETTE.ramps.metal[1],
  z: PALETTE.ramps.metal[2],
}

/** Растр со всеми сочетаниями каналов с шагом 17 и альфой по кругу: цвета и прозрачность вне палитры. */
const createNoise = (): { image: ReturnType<typeof createImage>; visible: number } => {
  const image = createImage(64, 64)
  let visible = 0

  for (let pixel = 0; pixel < 64 * 64; pixel++) {
    const alpha = (pixel * 37) % 256

    image.data.set([(pixel * 17) % 256, (pixel * 53) % 256, (pixel * 101) % 256, alpha], pixel * 4)

    if (alpha >= 128) visible += 1
  }

  return { image, visible }
}

describe('пайп palette', () => {
  it('приводит каждый пиксель к цвету палитры с альфой 0 или 255 и считает пиксели вне палитры', () => {
    const index = indexPalette(PALETTE)
    const { image, visible } = createNoise()
    const { image: result, outside } = quantizeImage(image, index, 'binary')

    for (let offset = 0; offset < result.data.length; offset += 4) {
      const [red, green, blue, alpha] = result.data.subarray(offset, offset + 4)

      expect([0, 255]).toContain(alpha)
      if (alpha === 255) expect(index.byColor.has((red << 16) | (green << 8) | blue)).toBe(true)
      else expect([red, green, blue]).toEqual([0, 0, 0])
    }

    expect(outside).toBe(visible)
  })

  it('возвращает близкий цвет к его цвету палитры и не трогает точные цвета', () => {
    const index = indexPalette(PALETTE)
    const image = createImage(index.entries.length, 2)

    index.entries.forEach((entry, x) => {
      image.data.set([...entry.rgb, 255], x * 4)
      image.data.set([...entry.rgb.map((channel) => Math.min(255, channel + 3)), 255], (index.entries.length + x) * 4)
    })

    const { image: result, outside } = quantizeImage(image, index, 'binary')

    expect(toRows(result, LEGEND)).toEqual(['abcxyz', 'abcxyz'])
    expect(outside).toBe(index.entries.length)
  })

  it('переводит цвета в другую палитру по рампе и ступени', () => {
    const image = fromRows(['abc.', 'xyz.'], LEGEND)
    const result = remapImage(image, indexPalette(PALETTE), indexPalette(TARGET))
    const targetLegend = {
      a: TARGET.ramps.neon[0],
      b: TARGET.ramps.neon[1],
      c: TARGET.ramps.neon[2],
      x: TARGET.ramps.metal[0],
      y: TARGET.ramps.metal[1],
      z: TARGET.ramps.metal[2],
    }

    expect(toRows(result, targetLegend)).toEqual(['abc.', 'xyz.'])
  })

  it('затемняет и подсвечивает на ступень внутри рампы, не выходя за крайние ступени', () => {
    const index = indexPalette(PALETTE)
    const image = fromRows(['abc', 'xyz'], LEGEND)

    expect(toRows(shiftSteps(image, index, -1), LEGEND)).toEqual(['aab', 'xxy'])
    expect(toRows(shiftSteps(image, index, 1), LEGEND)).toEqual(['bcc', 'yzz'])
  })

  it('с заданной непрозрачностью ставит её всем видимым пикселям', () => {
    const image = fromRows(['a.', '.z'], LEGEND)
    const { image: result } = quantizeImage(image, indexPalette(PALETTE), 0.4)

    expect([result.data[3], result.data[7], result.data[11], result.data[15]]).toEqual([102, 0, 0, 102])
    expect(Array.from(result.data.subarray(0, 3))).toEqual([...parseHex(LEGEND.a)])
  })
})
