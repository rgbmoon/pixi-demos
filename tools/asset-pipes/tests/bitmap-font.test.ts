import opentype from 'opentype.js'
import { describe, expect, it } from 'vitest'

import { createIconGlyph, formatBmfont, packGlyphs, rasterizeFont } from '#src/utils/bmfont'

import { fromRows, toRows } from './setup/raster'

// opentype.js 1.x собран как UMD: Node отдаёт его экспорты только через default
// eslint-disable-next-line import/no-named-as-default-member
const { Font, Glyph, Path } = opentype

/** TTF с одним глифом «A»: прямоугольник 3 × 5 единиц при em в 8 единиц, то есть 3 × 5 пикселей при кегле 8. */
const createFont = (): ArrayBuffer => {
  const rectangle = new Path()

  rectangle.moveTo(0, 0)
  rectangle.lineTo(0, 5)
  rectangle.lineTo(3, 5)
  rectangle.lineTo(3, 0)
  rectangle.close()

  return new Font({
    familyName: 'Test',
    styleName: 'Regular',
    unitsPerEm: 8,
    ascender: 7,
    descender: -1,
    glyphs: [
      new Glyph({ name: '.notdef', unicode: 0, advanceWidth: 4, path: new Path() }),
      new Glyph({ name: 'A', unicode: 65, advanceWidth: 4, path: rectangle }),
    ],
  }).toArrayBuffer()
}

/** Поля строки `char` файла BMFont по коду символа. */
const readChar = (fnt: string, id: number): Record<string, number> => {
  const line = fnt.split('\n').find((row) => row.startsWith(`char id=${id} `)) ?? ''

  return Object.fromEntries(
    line
      .split(' ')
      .slice(1)
      .map((pair) => [pair.split('=')[0], Number(pair.split('=')[1])])
  )
}

describe('пайп bitmap-font', () => {
  it('записывает ширину и высоту глифа, равные его растру, и растеризует без сглаживания', () => {
    const { font, missing } = rasterizeFont(createFont(), 'test', 8, 'AB', [255, 255, 255])
    const icon = createIconGlyph(0x2665, fromRows(['#.#', '###', '.#.'], { '#': '#f1219f' }), font.base)
    const glyphs = [...font.glyphs, icon]
    const fnt = formatBmfont({ ...font, glyphs }, packGlyphs(glyphs), 'test.png')

    expect(missing).toEqual(['B'])
    expect(toRows(font.glyphs[0].image, { w: '#ffffff' })).toEqual(['www', 'www', 'www', 'www', 'www'])

    for (const glyph of glyphs) {
      expect(readChar(fnt, glyph.id)).toMatchObject({ width: glyph.image.width, height: glyph.image.height })
    }

    // Глиф стоит на базовой линии: его низ на высоте base от верха строки
    expect(readChar(fnt, 65)).toMatchObject({ width: 3, height: 5, yoffset: font.base - 5, xadvance: 4 })
  })
})
