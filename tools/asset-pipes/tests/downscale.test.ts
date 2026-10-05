import { describe, expect, it } from 'vitest'

import { downscaleImage } from '#src/utils/downscale'

import { fromRows, toRows } from './setup/raster'

const LEGEND = { o: '#080633', f: '#c8878c', s: '#e9b6b1', e: '#2f3e52' }

describe('уменьшение пиксель-арта', () => {
  it('держит сплошной контур и тёмную деталь, цвета берёт из исходника', () => {
    const source = fromRows(
      [
        '..oooooo..',
        '.offffffo.',
        'offsfffffo',
        'offeefsffo',
        'offeeffffo',
        'offffffsfo',
        'offffffffo',
        '.offffffo.',
        '..oooooo..',
      ],
      LEGEND
    )

    expect(toRows(downscaleImage(source, 0.6), LEGEND)).toEqual(['.oooo.', 'offffo', 'ofeffo', 'offffo', '.oooo.'])
  })
})
