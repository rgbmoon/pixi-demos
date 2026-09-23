import {
  CLAW_ACCELERATION,
  CLAW_BRAKE_ACCELERATION,
  CLAW_BRAKE_MS,
  CLAW_MIN_SPEED,
  CLAW_RESPONSE_MS,
  MOTION_MIN_DURATION_SCALE,
  MOTION_WEIGHT_GAIN,
  SPRING_MAX_DAMPING,
  SPRING_MIN_VALUE,
  SPRING_MIN_VELOCITY,
  TOY_FALL_MS,
  TOY_MIN_MOTION_MS,
  TOY_TRAVEL_MS,
} from '#src/constants'
import type { GroundPoint, SpringOptions, SpringState, WorldPoint } from '#src/types'

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

/**
 * Множитель длительности движения с учётом веса игрушки.
 */
export const getMotionDurationScale = (weight: number): number =>
  clamp(1 - MOTION_WEIGHT_GAIN * (weight - 1), MOTION_MIN_DURATION_SCALE, 1)

/**
 * Длительность движения в миллисекундах: максимум вертикального, горизонтального пути и
 * базового минимума, умноженный на коэффициент веса игрушки.
 */
export const getMotionMs = (weight: number, from: WorldPoint, to: WorldPoint): number => {
  const fall = Math.abs(from.z - to.z) * TOY_FALL_MS
  const travel = Math.hypot(to.x - from.x, to.y - from.y) * TOY_TRAVEL_MS

  return Math.max(fall, travel, TOY_MIN_MOTION_MS) * getMotionDurationScale(weight)
}
