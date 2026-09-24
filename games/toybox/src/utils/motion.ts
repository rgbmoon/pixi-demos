import {
  CLAW_ACCELERATION,
  CLAW_BRAKE_ACCELERATION,
  CLAW_BRAKE_MS,
  CLAW_MIN_SPEED,
  CLAW_RESPONSE_MS,
  FUMBLE_START_CLEARANCE,
  SPRING_MAX_DAMPING,
  SPRING_MIN_VALUE,
  SPRING_MIN_VELOCITY,
  TRAY_ORIGIN,
  TRAY_SIZE,
} from '#src/constants'
import type { GroundPoint, SpringOptions, SpringState } from '#src/types'
import type { Random } from '@pixi-demos/core/types'

import { clamp } from './math'

/**
 * Ведёт скорость клешни к целевой за `deltaMs`.
 */
export const advanceVelocity = (velocity: GroundPoint, target: GroundPoint, deltaMs: number): GroundPoint => {
  const gapX = target.x - velocity.x
  const gapY = target.y - velocity.y
  const gap = Math.hypot(gapX, gapY)

  if (gap === 0) return velocity

  const isBraking = target.x === 0 && target.y === 0
  const limit = ((isBraking ? CLAW_BRAKE_ACCELERATION : CLAW_ACCELERATION) * deltaMs) / 1000
  const responseMs = isBraking ? CLAW_BRAKE_MS : CLAW_RESPONSE_MS
  const change = Math.min(gap * (1 - Math.exp(-deltaMs / responseMs)), limit)
  const next = { x: velocity.x + (gapX / gap) * change, y: velocity.y + (gapY / gap) * change }

  return isBraking && Math.hypot(next.x, next.y) < CLAW_MIN_SPEED ? { x: 0, y: 0 } : next
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
