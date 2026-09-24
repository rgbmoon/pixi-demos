import { FUMBLE_START_CLEARANCE, TRAY_ORIGIN, TRAY_SIZE } from '#src/constants'
import type { GroundPoint } from '#src/types'
import { clamp } from '#src/utils/math'
import type { Random } from '@pixi-demos/core/types'

import {
  CLAW_ACCELERATION,
  CLAW_BRAKE_ACCELERATION,
  SPRING_MAX_DAMPING,
  SPRING_MIN_VALUE,
  SPRING_MIN_VELOCITY,
} from './constants'
import type { SpringOptions, SpringState } from './types'

/**
 * Скорость клешни через `deltaMs`: меняется к целевой с постоянным ускорением и становится целевой, когда до неё
 * меньше шага. Ускорение остановки — `CLAW_BRAKE_ACCELERATION`, разгона и смены направления — `CLAW_ACCELERATION`.
 */
export const advanceVelocity = (velocity: GroundPoint, target: GroundPoint, deltaMs: number): GroundPoint => {
  const gapX = target.x - velocity.x
  const gapY = target.y - velocity.y
  const gap = Math.hypot(gapX, gapY)
  const acceleration = target.x === 0 && target.y === 0 ? CLAW_BRAKE_ACCELERATION : CLAW_ACCELERATION
  const change = (acceleration * deltaMs) / 1000

  if (gap <= change) return { ...target }

  return { x: velocity.x + (gapX / gap) * change, y: velocity.y + (gapY / gap) * change }
}

/**
 * Шаг затухающей пружины: ведёт отклонение к цели за `deltaMs`. Считается аналитическим решением
 * осциллятора, поэтому устойчив на шаге любой длины — тикер отдаёт кадры до 100 мс, на которых
 * явная схема разошлась бы. У цели отклонение и скорость гасятся, иначе пружина не остановится.
 */
export const advanceSpring = (
  state: SpringState,
  { target, periodMs, damping }: SpringOptions,
  deltaMs: number
): SpringState => {
  const omega = (2 * Math.PI * 1000) / periodMs
  const zeta = clamp(damping, 0, SPRING_MAX_DAMPING)
  const dampedOmega = omega * Math.sqrt(1 - zeta * zeta)
  const seconds = deltaMs / 1000
  const decay = Math.exp(-zeta * omega * seconds)
  const offset = state.value - target
  // Коэффициенты решения x(t) = target + decay·(offset·cos + slope·sin), взятые из начальных условий
  const slope = (state.velocity + zeta * omega * offset) / dampedOmega
  const cos = Math.cos(dampedOmega * seconds)
  const sin = Math.sin(dampedOmega * seconds)
  const value = target + decay * (offset * cos + slope * sin)
  const velocity =
    decay * ((slope * dampedOmega - zeta * omega * offset) * cos - (offset * dampedOmega + zeta * omega * slope) * sin)

  if (Math.abs(value - target) < SPRING_MIN_VALUE && Math.abs(velocity) < SPRING_MIN_VELOCITY) {
    return { value: target, velocity: 0 }
  }

  return { value, velocity }
}

/** Доля пути от `from` к `to`, на которой путь входит в лоток: 0 — путь начинается над лотком, 1 — не входит в него. */
const getTrayEntryShare = (from: GroundPoint, to: GroundPoint): number => {
  let enter = 0
  let exit = 1

  for (const axis of ['x', 'y'] as const) {
    const distance = to[axis] - from[axis]
    const low = TRAY_ORIGIN[axis]
    const high = TRAY_ORIGIN[axis] + TRAY_SIZE

    if (distance === 0) {
      if (from[axis] < low || from[axis] > high) return 1
      continue
    }

    const first = (low - from[axis]) / distance
    const second = (high - from[axis]) / distance

    enter = Math.max(enter, Math.min(first, second))
    exit = Math.min(exit, Math.max(first, second))
  }

  return enter <= exit ? enter : 1
}

/**
 * Доля пути клешни от `from` к `to`, на которой она роняет игрушку: равномерно по длине участка, который
 * начинается дальше `FUMBLE_START_CLEARANCE` от места захвата и заканчивается на входе в лоток. Без такого
 * участка — `undefined`.
 */
export const pickFumbleShare = (from: GroundPoint, to: GroundPoint, random: Random): number | undefined => {
  const length = Math.hypot(to.x - from.x, to.y - from.y)

  if (length === 0) return undefined

  const start = FUMBLE_START_CLEARANCE / length
  const end = getTrayEntryShare(from, to)

  return end > start ? start + random() * (end - start) : undefined
}
