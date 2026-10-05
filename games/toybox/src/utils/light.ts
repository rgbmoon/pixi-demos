import type { Texture } from 'pixi.js'

import {
  FLICKER_MAX_DIP_MS,
  FLICKER_MAX_DIPS,
  FLICKER_MAX_RETURN_MS,
  FLICKER_MIN_DIP_MS,
  FLICKER_MIN_RETURN_MS,
} from '#src/constants'
import { Light, type LightStep } from '#src/types'
import type { Random } from '@pixi-demos/core/types'
import type { FrameSequence } from '@pixi-demos/engine/types'

import { lerp } from './math'

/**
 * Одно мерцание света: ровный свет от `minPauseMs` до `maxPauseMs`, затем несколько коротких провалов до одного из
 * состояний `dips` с возвратом к ровному свету.
 */
export const pickFlicker = (
  random: Random,
  minPauseMs: number,
  maxPauseMs: number,
  dips: readonly Light[]
): LightStep[] => {
  const steps: LightStep[] = [[Light.on, lerp(minPauseMs, maxPauseMs, random())]]
  const count = 1 + Math.floor(random() * FLICKER_MAX_DIPS)

  for (let dip = 0; dip < count; dip++) {
    steps.push(
      [dips[Math.floor(random() * dips.length)], lerp(FLICKER_MIN_DIP_MS, FLICKER_MAX_DIP_MS, random())],
      [Light.on, lerp(FLICKER_MIN_RETURN_MS, FLICKER_MAX_RETURN_MS, random())]
    )
  }

  return steps
}

/** Покадровая анимация шагов света: кадр каждого шага берётся по состоянию света. */
export const toLightSequence = (
  textures: Readonly<Record<Light, Texture>>,
  steps: readonly LightStep[]
): FrameSequence => ({
  frames: steps.map(([light]) => textures[light]),
  durations: steps.map(([, ms]) => ms),
})
