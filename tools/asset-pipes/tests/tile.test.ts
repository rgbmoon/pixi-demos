import { describe, expect, it } from 'vitest'

import { TILE_SEAM_RATIO } from '#src/constants'
import { createImage } from '#src/utils/image'
import { measureSeam } from '#src/utils/tile'

const SIZE = 16

describe('пайп tile-check', () => {
  it('не находит шва у тайла, чей узор продолжается через край', () => {
    const tile = createImage(SIZE, SIZE)

    // Период узора 4 делит сторону тайла: край продолжает узор
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) tile.data.set([((x + 2 * y) % 4) * 60, 40, 90, 255], (y * SIZE + x) * 4)
    }

    expect(measureSeam(tile, 'x')).toBeLessThanOrEqual(TILE_SEAM_RATIO)
    expect(measureSeam(tile, 'y')).toBeLessThanOrEqual(TILE_SEAM_RATIO)
  })

  it('находит шов у тайла с градиентом поперёк оси', () => {
    const tile = createImage(SIZE, SIZE)

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) tile.data.set([x * 16, 40, 90, 255], (y * SIZE + x) * 4)
    }

    expect(measureSeam(tile, 'x')).toBeGreaterThan(TILE_SEAM_RATIO)
    expect(measureSeam(tile, 'y')).toBe(0)
  })
})
