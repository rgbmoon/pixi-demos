import {
  FLICKER_MAX_DIP_MS,
  FLICKER_MAX_DIPS,
  FLICKER_MAX_RETURN_MS,
  FLICKER_MIN_DIP_MS,
  FLICKER_MIN_RETURN_MS,
} from '#src/constants'
import { LampLight, type LightStep } from '#src/types'
import type { Random } from '@pixi-demos/core/types'

import { lerp } from './math'

/**
 * Одно мерцание света: ровный свет от `minPauseMs` до `maxPauseMs`, затем несколько коротких провалов до одного из
 * состояний `dips` с возвратом к ровному свету.
 */
export const pickFlicker = (
  random: Random,
  minPauseMs: number,
  maxPauseMs: number,
  dips: readonly LampLight[]
): LightStep[] => {
  const steps: LightStep[] = [[LampLight.on, lerp(minPauseMs, maxPauseMs, random())]]
  const count = 1 + Math.floor(random() * FLICKER_MAX_DIPS)

  for (let dip = 0; dip < count; dip++) {
    steps.push(
      [dips[Math.floor(random() * dips.length)], lerp(FLICKER_MIN_DIP_MS, FLICKER_MAX_DIP_MS, random())],
      [LampLight.on, lerp(FLICKER_MIN_RETURN_MS, FLICKER_MAX_RETURN_MS, random())]
    )
  }

  return steps
}
