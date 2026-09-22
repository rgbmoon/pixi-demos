import { describe, expect, it } from 'vitest'

import {
  AXIS_Y,
  DROP_BUTTON_CENTER,
  JOYSTICK_CENTER,
  PIXEL_SCALE,
  PRIZE_HATCH_CENTER,
  RESET_BUTTON_CENTER,
} from '#src/constants'
import {
  CONTROL_PANEL_PLANE,
  getCabinetOutlines,
  getMarqueeOutlines,
  getPrizeHatchOutline,
  projectPlaneOffset,
  projectWorldOutline,
  screenToPlaneOffset,
} from '#src/utils/machine-geometry'
import { worldToScreen } from '#src/utils/projection'

describe('геометрия корпуса автомата', () => {
  it('строит панель из мировых точек и сохраняет оси проекции', () => {
    const panel = projectWorldOutline(getCabinetOutlines()[0])

    expect(panel[1].x - panel[0].x).toBe(AXIS_Y.x * 8)
    expect(panel[1].y - panel[0].y).toBe(AXIS_Y.y * 8)
    expect(panel[3]).toEqual({ x: -24, y: 88 })
  })

  it('проецирует симметричные центры элементов на выбранные грани', () => {
    expect(worldToScreen(JOYSTICK_CENTER)).toEqual({ x: -140, y: 36 })
    expect(worldToScreen(DROP_BUTTON_CENTER)).toEqual({ x: -396, y: 20 })
    expect(worldToScreen(PRIZE_HATCH_CENTER)).toEqual({ x: -280, y: 324 })
    expect(worldToScreen(RESET_BUTTON_CENTER)).toEqual({ x: -88, y: 524 })
  })

  it('привязывает все статические контуры к шагу рабочего пикселя', () => {
    const points = [
      ...getCabinetOutlines().flatMap(projectWorldOutline),
      ...getMarqueeOutlines().flatMap(projectWorldOutline),
      ...getPrizeHatchOutline(),
    ]

    for (const point of points) {
      expect(Math.abs(point.x % PIXEL_SCALE)).toBe(0)
      expect(Math.abs(point.y % PIXEL_SCALE)).toBe(0)
    }
  })

  it('обращает проекцию панели в тех же дизайн-пикселях', () => {
    const plane = { x: 32, y: -20 }
    const screen = projectPlaneOffset(CONTROL_PANEL_PLANE, plane.x, plane.y)

    expect(screenToPlaneOffset(CONTROL_PANEL_PLANE, screen)).toEqual(plane)
  })
})
