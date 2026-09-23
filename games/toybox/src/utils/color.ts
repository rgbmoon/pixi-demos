import { TOY_HUE_SPREAD, TOY_LIGHTNESS_SPREAD } from '#src/constants'
import type { Random } from '@pixi-demos/core/types'

import { clamp } from './math'

/** Компоненты цвета в HSL: тон в градусах, насыщенность и светлота в долях единицы. */
const toHsl = (color: string): { h: number; s: number; l: number } => {
  const rgb = Number.parseInt(color.slice(1), 16)
  const r = ((rgb >> 16) & 255) / 255
  const g = ((rgb >> 8) & 255) / 255
  const b = (rgb & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const span = max - min
  const l = (max + min) / 2

  if (span === 0) return { h: 0, s: 0, l }

  const s = span / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / span) % 6 : max === g ? (b - r) / span + 2 : (r - g) / span + 4

  return { h: (((h * 60) % 360) + 360) % 360, s, l }
}

/** Цвет игрушки: корневой цвет со случайным сдвигом тона и светлоты. */
export const shiftColor = (base: string, random: Random): number => {
  const { h, s, l } = toHsl(base)
  const hue = (((h + (random() * 2 - 1) * TOY_HUE_SPREAD) % 360) + 360) % 360
  const lightness = clamp(l + (random() * 2 - 1) * TOY_LIGHTNESS_SPREAD, 0.2, 0.8)

  const amplitude = s * Math.min(lightness, 1 - lightness)
  const channel = (offset: number): number => {
    const k = (offset + hue / 30) % 12

    return Math.round(255 * (lightness - amplitude * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
  }

  return (channel(0) << 16) | (channel(8) << 8) | channel(4)
}
