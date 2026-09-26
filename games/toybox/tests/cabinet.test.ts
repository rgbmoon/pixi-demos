import { describe, expect, it } from 'vitest'

import { ART_PIXEL, MACHINE_CANVAS_SHARE, MACHINE_MARGIN, TOY_ANGLE_STEP, TRAY_CENTER } from '#src/constants'
import { TRAY_EXIT_Z } from '#src/heap/constants'
import { SHAPE_KEYS } from '#src/toys'
import type { ScreenPoint } from '#src/types'
import { getCabinetOutlines, getMachineBounds, getMachineLayout } from '#src/utils/machine-geometry'
import { worldToScreen } from '#src/utils/projection'
import { getShapeOutline, getVariantCount } from '#src/utils/shapes'

/**
 * Канвасы: ширина и высота области под шапкой страницы в CSS-пикселях и плотность рендера. Десктоп 1920×1080,
 * ноутбук 1440×900 при DPR 2, телефон 393×852 при DPR 3 и окно браузера на экране 1920×1080 с масштабом
 * системы 125 %. Нечётная ширина телефона и дробная плотность сдвигают центр канваса с пикселя рендера.
 */
const CANVASES = [
  [1920, 1016, 1],
  [1440, 836, 2],
  [393, 788, 3],
  [1536, 666, 1.25],
] as const

/** Сколько положений крена проверяется на полный оборот игрушки. */
const ANGLE_SAMPLES = 24

/** Запас вокруг силуэта игрушки на обводку, в единицах сцены. */
const OUTLINE_MARGIN = 6

/** Лежит ли точка внутри многоугольника: чётность пересечений горизонтального луча с его рёбрами. */
const isInside = (polygon: readonly ScreenPoint[], { x, y }: ScreenPoint): boolean => {
  let inside = false

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index++) {
    const a = polygon[index]
    const b = polygon[previous]

    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }

  return inside
}

/** Края автомата на канвасе: отступы слева, справа, сверху и снизу. */
const getMargins = (width: number, height: number, resolution: number): number[] => {
  const bounds = getMachineBounds()
  const layout = getMachineLayout(width, height, resolution)

  return [
    layout.x + bounds.left * layout.scale,
    width - (layout.x + bounds.right * layout.scale),
    layout.y + bounds.top * layout.scale,
    height - (layout.y + bounds.bottom * layout.scale),
  ]
}

describe('корпус автомата', () => {
  it('отдаёт пикселю арта целое число пикселей рендера и ставит автомат на пиксель рендера', () => {
    for (const [width, height, resolution] of CANVASES) {
      const { scale, x, y } = getMachineLayout(width, height, resolution)

      for (const renderPixels of [scale * ART_PIXEL * resolution, x * resolution, y * resolution]) {
        expect(renderPixels).toBeCloseTo(Math.round(renderPixels))
      }
    }
  })

  it('берёт наибольший целый масштаб, при котором автомат с отступами помещается в свою долю канваса', () => {
    const { left, right, top, bottom } = getMachineBounds()

    for (const [width, height, resolution] of CANVASES) {
      // Следующий шаг: на один пиксель рендера больше на пиксель арта
      const larger = getMachineLayout(width, height, resolution).scale + 1 / (ART_PIXEL * resolution)
      const fits =
        (right - left + 2 * MACHINE_MARGIN) * larger <= width * MACHINE_CANVAS_SHARE &&
        (bottom - top + 2 * MACHINE_MARGIN) * larger <= height * MACHINE_CANVAS_SHARE

      expect(fits).toBe(false)
    }
  })

  it('ставит автомат в центр канваса с точностью до пикселя рендера', () => {
    for (const [width, height, resolution] of CANVASES) {
      const [left, right, top, bottom] = getMargins(width, height, resolution)

      expect(Math.abs(left - right)).toBeLessThanOrEqual(1 / resolution + 1e-6)
      expect(Math.abs(top - bottom)).toBeLessThanOrEqual(1 / resolution + 1e-6)
    }
  })

  it('оставляет вокруг автомата не меньше одной ячейки', () => {
    for (const [width, height, resolution] of CANVASES) {
      const { scale } = getMachineLayout(width, height, resolution)

      for (const margin of getMargins(width, height, resolution)) {
        expect(margin).toBeGreaterThanOrEqual(MACHINE_MARGIN * scale - 1e-6)
      }
    }
  })

  it('закрывает игрушку, ушедшую из шахты лотка, при любой форме и крене', () => {
    const faces = getCabinetOutlines().map((face) => face.map((point) => worldToScreen(point)))
    const origin = worldToScreen({ ...TRAY_CENTER, z: TRAY_EXIT_Z })
    const stepsPerTurn = Math.round((2 * Math.PI) / TOY_ANGLE_STEP)
    const exposed: string[] = []

    for (const shape of SHAPE_KEYS) {
      for (let variant = 0; variant < getVariantCount(shape); variant++) {
        for (let sample = 0; sample < ANGLE_SAMPLES; sample++) {
          const step = Math.round((sample * stepsPerTurn) / ANGLE_SAMPLES)
          const outline = getShapeOutline(shape, variant, step)

          // Вершины и середины рёбер силуэта, сдвинутые на ширину обводки во все стороны
          for (const [index, from] of outline.entries()) {
            const to = outline[(index + 1) % outline.length]

            for (const share of [0, 0.5]) {
              for (let turn = 0; turn < 8; turn++) {
                const point = {
                  x: origin.x + from.x + (to.x - from.x) * share + OUTLINE_MARGIN * Math.cos((turn * Math.PI) / 4),
                  y: origin.y + from.y + (to.y - from.y) * share + OUTLINE_MARGIN * Math.sin((turn * Math.PI) / 4),
                }

                if (!faces.some((face) => isInside(face, point))) exposed.push(`${shape}/${variant}, шаг крена ${step}`)
              }
            }
          }
        }
      }
    }

    expect([...new Set(exposed)]).toEqual([])
  })
})
