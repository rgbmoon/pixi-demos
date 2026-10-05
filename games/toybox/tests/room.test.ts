import { describe, expect, it } from 'vitest'

import { ART_PIXEL, CABINET_BOTTOM_Z, GRID_SIZE } from '#src/constants'
import { worldToScreen } from '#src/utils/projection'
import { getPlinthY } from '#src/utils/room'

describe('фон зала', () => {
  it('ставит плинтус выше заднего угла тумбы: автомат стоит на полу перед стеной', () => {
    const corner = worldToScreen({ x: GRID_SIZE, y: 0, z: CABINET_BOTTOM_Z })

    expect(getPlinthY() * ART_PIXEL).toBeLessThan(corner.y)
  })
})
