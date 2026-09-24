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
  GRID_SIZE,
  SHAPE_KEYS,
  SHAPES,
} from '#src/constants'
import type { DomeProfile, GroundPoint, ShapeKey } from '#src/types'
import type { Random } from '@pixi-demos/core/types'

import { clamp, lerp } from './math'

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
