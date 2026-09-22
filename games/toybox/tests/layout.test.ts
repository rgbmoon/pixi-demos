import { describe, expect, it } from 'vitest'

import {
  ART_CELL_SIZE,
  ART_HEIGHT,
  ART_WIDTH,
  BOX_HEIGHT,
  CABINET_HEIGHT,
  CELL_SIZE,
  CUBE_HEIGHT,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  LINE_THICKNESS,
  MACHINE_HEIGHT,
  MACHINE_MAX_SCALE,
  MARQUEE_HEIGHT,
  PIXEL_SCALE,
  ROPE_REST_LENGTH,
  SCREEN_MARGIN,
} from '#src/constants'
import { getMachineLayout } from '#src/utils/layout'
import { getCabinetOutlines, getMachineBounds, getMarqueeOutlines, projectWorldOutline } from '#src/utils/machine-geometry'

describe('пиксельная сетка toybox', () => {
  it('связывает рабочий холст и дизайн целочисленным масштабом 4×', () => {
    expect(DESIGN_WIDTH).toBe(ART_WIDTH * PIXEL_SCALE)
    expect(DESIGN_HEIGHT).toBe(ART_HEIGHT * PIXEL_SCALE)
    expect(CELL_SIZE).toBe(ART_CELL_SIZE * PIXEL_SCALE)
  })

  it('собирает высоту автомата из табло, бокса и тумбы', () => {
    const bounds = getMachineBounds()

    expect(CUBE_HEIGHT).toBe(8)
    expect(ROPE_REST_LENGTH).toBe(1.5)
    expect(BOX_HEIGHT).toBe(608)
    expect(CABINET_HEIGHT).toBe(592)
    expect(MARQUEE_HEIGHT).toBe(64)
    expect(MACHINE_HEIGHT).toBe(1264)
    expect(bounds).toEqual({ left: -536, right: 64, top: -672, bottom: 592, width: 600, height: 1264 })
  })
})

describe('getMachineLayout', () => {
  it('центрирует измеренные границы автомата', () => {
    const bounds = getMachineBounds()
    const layout = getMachineLayout(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT)
    const left = layout.x + bounds.left * layout.scale
    const right = layout.x + bounds.right * layout.scale
    const top = layout.y + bounds.top * layout.scale
    const bottom = layout.y + bounds.bottom * layout.scale

    expect(layout.scale).toBe(MACHINE_MAX_SCALE)
    expect((left + right) / 2).toBeCloseTo(DESIGN_WIDTH / 2)
    expect((top + bottom) / 2).toBeCloseTo(DESIGN_HEIGHT / 2)
  })

  it('оставляет вершины и толщину линий на целых пикселях после увеличения', () => {
    const layout = getMachineLayout(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT)
    const points = [...getCabinetOutlines(), ...getMarqueeOutlines()].flatMap(projectWorldOutline)

    expect(layout).toEqual({ scale: 1.5, x: 930, y: 1084 })
    expect(LINE_THICKNESS * layout.scale).toBe(6)

    for (const point of points) {
      expect(Number.isInteger(layout.x + point.x * layout.scale)).toBe(true)
      expect(Number.isInteger(layout.y + point.y * layout.scale)).toBe(true)
    }
  })

  it('оставляет не меньше одной ячейки с каждой стороны', () => {
    const bounds = getMachineBounds()
    const layout = getMachineLayout(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT)
    const margins = [
      layout.x + bounds.left * layout.scale,
      DESIGN_WIDTH - (layout.x + bounds.right * layout.scale),
      layout.y + bounds.top * layout.scale,
      DESIGN_HEIGHT - (layout.y + bounds.bottom * layout.scale),
    ]

    for (const margin of margins) expect(margin).toBeGreaterThanOrEqual(SCREEN_MARGIN - 0.000_001)
  })
})
