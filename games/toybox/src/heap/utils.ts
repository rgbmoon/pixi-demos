import { CUBE_HEIGHT, GRID_SIZE, HEAP_SNAPSHOT_VERSION } from '#src/constants'
import { SHAPE_KEYS, SHAPES } from '#src/toys'
import type { GroundPoint, HeapSnapshot, HeapSnapshotBody, ShapeKey, ToyPose } from '#src/types'
import { clamp, lerp } from '#src/utils/math'
import type { Random } from '@pixi-demos/core/types'

import {
  DOME_CENTER_HEIGHT,
  DOME_EDGE_HEIGHT,
  DOME_FALLOFF_MAX,
  DOME_FALLOFF_MIN,
  DOME_PEAK_JITTER,
  GRAB_BASE_CHANCE,
  GRAB_LOAD_PENALTY,
  GRAB_MAX_CHANCE,
  GRAB_MIN_CHANCE,
  GRAB_WEIGHT_PENALTY,
  TOY_HUE_SPREAD,
  TOY_LIGHTNESS_SPREAD,
} from './constants'
import type { DomeProfile } from './types'

/**
 * Вероятность захвата с учётом веса игрушки и нагрузки сверху.
 */
export const getGrabChance = (weight: number, load: number): number =>
  clamp(
    GRAB_BASE_CHANCE / (1 + GRAB_WEIGHT_PENALTY * weight + GRAB_LOAD_PENALTY * load),
    GRAB_MIN_CHANCE,
    GRAB_MAX_CHANCE
  )

/** Форма для наполнения: выбор с весами `fillWeight`. */
export const pickShape = (random: Random): ShapeKey => {
  const total = SHAPE_KEYS.reduce((sum, key) => sum + SHAPES[key].fillWeight, 0)
  let roll = random() * total

  for (const key of SHAPE_KEYS) {
    roll -= SHAPES[key].fillWeight

    if (roll < 0) return key
  }

  return SHAPE_KEYS[SHAPE_KEYS.length - 1]
}

/** Профиль купола: бросок сдвигает пик от центра поля и задаёт крутизну склона. */
export const planDome = (random: Random): DomeProfile => {
  const middle = GRID_SIZE / 2
  const peak = {
    x: middle + (random() * 2 - 1) * DOME_PEAK_JITTER,
    y: middle + (random() * 2 - 1) * DOME_PEAK_JITTER,
  }
  const corners = [0, GRID_SIZE].flatMap((x) => [0, GRID_SIZE].map((y) => Math.hypot(x - peak.x, y - peak.y)))

  return {
    peak,
    falloff: DOME_FALLOFF_MIN + random() * (DOME_FALLOFF_MAX - DOME_FALLOFF_MIN),
    reach: Math.max(...corners),
  }
}

/** Высота верха купола над точкой пола: под пиком `DOME_CENTER_HEIGHT`, у дальнего угла `DOME_EDGE_HEIGHT`. */
export const getDomeHeight = ({ peak, falloff, reach }: DomeProfile, point: GroundPoint): number => {
  const slope = (Math.hypot(point.x - peak.x, point.y - peak.y) / reach) ** falloff

  return lerp(DOME_CENTER_HEIGHT, DOME_EDGE_HEIGHT, slope)
}

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

/** Предел числа игрушек в снимке: куча столько не вмещает, больший список — мусор. */
const MAX_BODIES = GRID_SIZE * GRID_SIZE * CUBE_HEIGHT

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const isInteger = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
const isNumberIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const isShapeKey = (value: unknown): value is ShapeKey => typeof value === 'string' && Object.hasOwn(SHAPES, value)

const isSnapshotBody = (value: unknown): value is HeapSnapshotBody => {
  if (!isRecord(value)) return false

  const { shape, variant, slab, y, z, angle, color } = value

  if (!isShapeKey(shape)) return false

  const { variants } = SHAPES[shape]

  if (!isInteger(variant, 0, variants.length - 1)) return false

  return (
    isInteger(slab, 0, GRID_SIZE - variants[variant].depth) &&
    isNumberIn(y, 0, GRID_SIZE) &&
    isNumberIn(z, 0, CUBE_HEIGHT) &&
    isNumberIn(angle, -Number.MAX_VALUE, Number.MAX_VALUE) &&
    isInteger(color, 0, 0xffffff)
  )
}

/** Проверяет весь снимок до загрузки: версию, схему и диапазоны каждой игрушки. */
export const isHeapSnapshot = (value: unknown): value is HeapSnapshot =>
  isRecord(value) &&
  value.version === HEAP_SNAPSHOT_VERSION &&
  isInteger(value.collected, 0, Number.MAX_SAFE_INTEGER) &&
  Array.isArray(value.bodies) &&
  value.bodies.length <= MAX_BODIES &&
  value.bodies.every(isSnapshotBody)

/**
 * Поза между двумя шагами физики на доле `share` пути от `from` к `to`. Крен идёт по кратчайшей дуге:
 * угол тела после смены позы приводится к полуинтервалу (−π, π], и прямая интерполяция прокрутила бы полный оборот.
 */
export const lerpPose = (from: ToyPose, to: ToyPose, share: number): ToyPose => {
  const turn = Math.atan2(Math.sin(to.angle - from.angle), Math.cos(to.angle - from.angle))

  return { y: lerp(from.y, to.y, share), z: lerp(from.z, to.z, share), angle: from.angle + turn * share }
}
