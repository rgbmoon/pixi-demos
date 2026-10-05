import { describe, expect, it } from 'vitest'

import { createIconGlyph, formatBmfont, packGlyphs } from '#src/utils/bmfont'

import { fromRows } from './setup/raster'

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
  it('записывает ширину и высоту глифа, равные его растру, и ставит низ каждого глифа на базовую линию', () => {
    const base = 5
    const glyphs = [
      createIconGlyph(0x2665, fromRows(['#.#', '###', '.#.'], { '#': '#f1219f' }), base),
      createIconGlyph(0x41, fromRows(['##', '##', '##', '##', '##'], { '#': '#ffffff' }), base),
    ]
    const fnt = formatBmfont(
      { face: 'test', size: base, lineHeight: base, base, glyphs },
      packGlyphs(glyphs),
      'test.png'
    )

    for (const glyph of glyphs) {
      const char = readChar(fnt, glyph.id)

      expect(char).toMatchObject({ width: glyph.image.width, height: glyph.image.height })
      expect(char.yoffset + char.height).toBe(base)
    }
  })
})
