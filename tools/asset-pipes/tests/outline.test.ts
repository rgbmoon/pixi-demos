import { describe, expect, it } from 'vitest'

import { isOpaque } from '#src/utils/image'
import { outlineImage, softenDarkest } from '#src/utils/outline'
import { parseHex } from '#src/utils/palette'

import { fromRows, toRows } from './setup/raster'

const SHAPE = fromRows(['.##..', '#..#.', '#.###', '.#...'], { '#': '#6e7c40' })

describe('пайп outline', () => {
  it('рисует контур на всех прозрачных соседях фигуры и не заходит на её пиксели', () => {
    for (const diagonal of [false, true]) {
      const outline = outlineImage(SHAPE, parseHex('#f97f96'), diagonal)
      const neighbors = diagonal
        ? [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => [dx, dy]))
        : [
            [0, -1],
            [-1, 0],
            [1, 0],
            [0, 1],
          ]

      for (let y = 0; y < outline.height; y++) {
        for (let x = 0; x < outline.width; x++) {
          const shapeX = x - 1
          const shapeY = y - 1
          const touchesShape = neighbors.some(([dx, dy]) => isOpaque(SHAPE, shapeX + dx, shapeY + dy))

          expect(isOpaque(outline, x, y)).toBe(!isOpaque(SHAPE, shapeX, shapeY) && touchesShape)
        }
      }
    }
  })

  it('смягчает самый тёмный цвет: край силуэта — цветом края, внутри — нижней ступенью рампы соседей', () => {
    const palette = { ramps: { indigo: ['#080633', '#200e64'], metal: ['#2b2a44', '#4c4869'], brown: ['#2e1916', '#4e2e26'] } }
    const legend = { k: '#080633', b: '#4e2e26', m: '#2b2a44', d: '#2e1916' }
    const source = fromRows(['.kkk.', 'kbbbk', 'kbkbk', 'kbbbk', '.kkk.'], legend)

    expect(toRows(softenDarkest(source, palette, '#080633', '#2b2a44'), legend)).toEqual([
      '.mmm.',
      'mbbbm',
      'mbdbm',
      'mbbbm',
      '.mmm.',
    ])
  })
})
