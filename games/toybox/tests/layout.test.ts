import { describe, expect, it } from 'vitest'

import { CUBE_HEIGHT, MACHINE_MARGIN, ROPE_REST_LENGTH } from '#src/constants'
import { getMachineBounds, getMachineLayout } from '#src/utils/machine-geometry'

/** Размеры канваса: телефон, планшет и десктопный бокс. */
const CANVAS_SIZES = [
  [390, 780],
  [768, 960],
  [385, 736],
] as const

describe('габариты автомата', () => {
  it('измеряет автомат по контурам тумбы и табло', () => {
    const bounds = getMachineBounds()

    expect(CUBE_HEIGHT).toBe(8)
    expect(ROPE_REST_LENGTH).toBe(1.5)
    expect(bounds).toEqual({ left: -536, right: 64, top: -672, bottom: 592 })
  })
})

describe('getMachineLayout', () => {
  it('центрирует измеренные границы автомата', () => {
    const bounds = getMachineBounds()

    for (const [width, height] of CANVAS_SIZES) {
      const layout = getMachineLayout(width, height)
      const left = layout.x + bounds.left * layout.scale
      const right = layout.x + bounds.right * layout.scale
      const top = layout.y + bounds.top * layout.scale
      const bottom = layout.y + bounds.bottom * layout.scale

      expect((left + right) / 2).toBeCloseTo(width / 2)
      expect((top + bottom) / 2).toBeCloseTo(height / 2)
    }
  })

  it('оставляет не меньше одной ячейки с каждой стороны', () => {
    const bounds = getMachineBounds()

    for (const [width, height] of CANVAS_SIZES) {
      const layout = getMachineLayout(width, height)
      const margins = [
        layout.x + bounds.left * layout.scale,
        width - (layout.x + bounds.right * layout.scale),
        layout.y + bounds.top * layout.scale,
        height - (layout.y + bounds.bottom * layout.scale),
      ]

      for (const margin of margins) expect(margin).toBeGreaterThanOrEqual(MACHINE_MARGIN * layout.scale - 0.000_001)
    }
  })
})
