import { BAYER_4 } from '#src/constants'
import type { LightSpot, RasterImage, RasterPoint, Rgb } from '#src/types'

import { createImage, getOffset } from './image'
import { hasNumbers, isRecord } from './json'

const isPoint = (value: unknown): value is RasterPoint => hasNumbers(value, ['x', 'y'])

/** Проверяет параметры пятна света из JSON; при ошибке сообщает поле. */
export const parseLightSpot = (value: unknown): LightSpot => {
  if (!isRecord(value)) throw new Error('Light spot must be an object')

  const { width, height, center, radius, ramp, steps, alpha } = value

  if (typeof width !== 'number' || typeof height !== 'number')
    throw new Error('Light spot needs numeric width and height')
  if (center !== undefined && !isPoint(center)) throw new Error('Light spot center must be { x, y }')
  if (typeof radius !== 'number' && !isPoint(radius)) throw new Error('Light spot radius must be a number or { x, y }')
  if (typeof ramp !== 'string') throw new Error('Light spot needs a ramp name')
  if (!Array.isArray(steps) || steps.length !== 2 || !steps.every((step) => Number.isInteger(step))) {
    throw new Error('Light spot steps must be [from, to]: ramp steps from dim to bright')
  }
  if (alpha !== undefined && (typeof alpha !== 'number' || alpha < 0 || alpha > 1)) {
    throw new Error('Light spot alpha must be a number from 0 to 1')
  }

  return { width, height, center, radius, ramp, steps: [steps[0], steps[1]], alpha }
}

/**
 * Пятно света или тени: радиальный градиент от центра к краю. Уровни градиента — цвета `colors` от тусклого
 * к яркому и прозрачный за краем; соседние уровни перемешаны упорядоченным дизерингом Bayer 4×4.
 */
export const renderLight = (spot: LightSpot, colors: readonly Rgb[]): RasterImage => {
  const image = createImage(spot.width, spot.height)
  const center = spot.center ?? { x: spot.width / 2, y: spot.height / 2 }
  const radius = typeof spot.radius === 'number' ? { x: spot.radius, y: spot.radius } : spot.radius
  const alpha = Math.round((spot.alpha ?? 1) * 255)

  for (let y = 0; y < spot.height; y++) {
    for (let x = 0; x < spot.width; x++) {
      const distance = Math.hypot((x + 0.5 - center.x) / radius.x, (y + 0.5 - center.y) / radius.y)

      if (distance >= 1) continue

      const value = (1 - distance) * colors.length
      const threshold = (BAYER_4[(y % 4) * 4 + (x % 4)] + 0.5) / 16
      const level = Math.min(colors.length, Math.floor(value) + (value % 1 > threshold ? 1 : 0))

      if (level === 0) continue

      image.data.set([...colors[level - 1], alpha], getOffset(image, x, y))
    }
  }

  return image
}
