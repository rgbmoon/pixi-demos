import {
  CLAW_ACCELERATION,
  CLAW_BRAKE_ACCELERATION,
  CLAW_BRAKE_MS,
  CLAW_MIN_SPEED,
  CLAW_RESPONSE_MS,
  SPRING_MAX_DAMPING,
  SPRING_MIN_VALUE,
  SPRING_MIN_VELOCITY,
} from '#src/constants'
import type { GroundPoint, SpringOptions, SpringState, ToyPose } from '#src/types'

import { clamp, lerp } from './math'

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

/**
 * Поза между двумя шагами физики на доле `share` пути от `from` к `to`. Крен идёт по кратчайшей дуге:
 * угол тела после смены позы приводится к полуинтервалу (−π, π], и прямая интерполяция прокрутила бы полный оборот.
 */
export const lerpPose = (from: ToyPose, to: ToyPose, share: number): ToyPose => {
  const turn = Math.atan2(Math.sin(to.angle - from.angle), Math.cos(to.angle - from.angle))

  return { y: lerp(from.y, to.y, share), z: lerp(from.z, to.z, share), angle: from.angle + turn * share }
}
