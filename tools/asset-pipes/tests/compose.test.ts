import { describe, expect, it } from 'vitest'

import { FACE_PARTS } from '#src/constants'
import type { RasterImage } from '#src/types'
import { composeFace } from '#src/utils/compose'

import { fromRows, toRows } from './setup/raster'

const LEGEND = { f: '#4c4869', t: '#a090b4', b: '#2b2a44', c: '#f0cdef', d: '#872c2f' }

const PARTS = new Map<string, RasterImage>([
  [FACE_PARTS.fill, fromRows(['f'], LEGEND)],
  [FACE_PARTS.edgeTop, fromRows(['tt'], LEGEND)],
  [FACE_PARTS.edgeBottom, fromRows(['bb'], LEGEND)],
  [FACE_PARTS.cornerTopLeft, fromRows(['cc', 'c.'], LEGEND)],
  [FACE_PARTS.cornerBottomRight, fromRows(['.c', 'cc'], LEGEND)],
  ['rust', fromRows(['dd'], LEGEND)],
])

describe('пайп compose', () => {
  it('собирает грань размером из раскладки, углы стоят в углах, декаль — у своего угла', () => {
    for (const [width, height] of [
      [6, 5],
      [9, 4],
    ]) {
      const rows = toRows(
        composeFace(PARTS, { width, height, decals: [{ name: 'rust', corner: 'bottom-right', x: 1, y: 1 }] }),
        LEGEND
      )

      expect(rows).toHaveLength(height)
      expect(rows.every((row) => row.length === width)).toBe(true)
      expect(rows[0].slice(0, 2) + rows[1][0]).toBe('ccc')
      expect(rows[height - 1].slice(-2) + rows[height - 2].at(-1)).toBe('ccc')
      expect(rows[height - 2].slice(-3, -1)).toBe('dd')
    }
  })
})
