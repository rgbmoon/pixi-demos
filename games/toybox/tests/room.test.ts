import { describe, expect, it } from 'vitest'

import { ART_PIXEL, CABINET_BOTTOM_Z, DECAL_BLOCK_SIZE, GRID_SIZE } from '#src/constants'
import { worldToScreen } from '#src/utils/projection'
import { getBlockDecals, getPlinthY } from '#src/utils/room'

/** Размеры вариантов декалей: крупный, средний кадр и узкие вертикальный и горизонтальный. */
const SIZES = [
  { width: 96, height: 96 },
  { width: 42, height: 42 },
  { width: 8, height: 40 },
  { width: 40, height: 6 },
]

describe('фон зала', () => {
  it('ставит плинтус выше заднего угла тумбы: автомат стоит на полу перед стеной', () => {
    const corner = worldToScreen({ x: GRID_SIZE, y: 0, z: CABINET_BOTTOM_Z })

    expect(getPlinthY() * ART_PIXEL).toBeLessThan(corner.y)
  })

  it('кладёт декаль целиком в её блок: на панель и в соседние блоки она не заходит', () => {
    let placed = 0

    for (let column = -12; column < 12; column++) {
      for (let row = 0; row < 12; row++) {
        for (const { variant, x, y } of getBlockDecals(column, row, SIZES)) {
          const { width, height } = SIZES[variant]

          placed += 1
          expect(x).toBeGreaterThanOrEqual(column * DECAL_BLOCK_SIZE)
          expect(x + width).toBeLessThanOrEqual((column + 1) * DECAL_BLOCK_SIZE)
          expect(y).toBeGreaterThanOrEqual(-(row + 1) * DECAL_BLOCK_SIZE)
          expect(y + height).toBeLessThanOrEqual(-row * DECAL_BLOCK_SIZE)
        }
      }
    }

    expect(placed).toBeGreaterThan(0)
  })
})
