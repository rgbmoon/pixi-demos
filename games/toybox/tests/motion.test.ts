import { describe, expect, it } from 'vitest'

import { CLAW_MAX_SPEED } from '#src/constants'
import type { GroundPoint } from '#src/types'
import { advanceVelocity } from '#src/utils'

/** Шаг кадра при 60 fps. */
const FRAME_MS = 1000 / 60

/** Страховка от бесконечного цикла, если скорость не дойдёт до цели. */
const MAX_FRAMES = 1000

const REST: GroundPoint = { x: 0, y: 0 }

const speedOf = ({ x, y }: GroundPoint): number => Math.hypot(x, y)

/** Сколько кадров уходит на выход в пределах 2% от цели. */
const framesToTarget = (target: GroundPoint): number => {
  const goal = speedOf(target)
  let velocity = REST

  for (let frames = 1; frames <= MAX_FRAMES; frames++) {
    velocity = advanceVelocity(velocity, target, FRAME_MS)

    if (Math.abs(speedOf(velocity) - goal) <= goal * 0.02) return frames
  }

  throw new Error('скорость не дошла до цели')
}

/** Кадры и путь торможения с предельной скорости до полной остановки. */
const brake = (from: GroundPoint): { frames: number; distance: number } => {
  let velocity = from
  let distance = 0

  for (let frames = 1; frames <= MAX_FRAMES; frames++) {
    velocity = advanceVelocity(velocity, REST, FRAME_MS)
    distance += (speedOf(velocity) * FRAME_MS) / 1000

    if (speedOf(velocity) === 0) return { frames, distance }
  }

  throw new Error('клешня не остановилась')
}

describe('advanceVelocity', () => {
  it('разгоняет клешню не мгновенно', () => {
    const full = { x: CLAW_MAX_SPEED, y: 0 }
    const first = advanceVelocity(REST, full, FRAME_MS)

    expect(first.x).toBeGreaterThan(0)
    expect(first.x).toBeLessThan(CLAW_MAX_SPEED / 2)
    expect(framesToTarget(full)).toBeGreaterThan(5)
  })

  it('выводит слабое отклонение на его скорость быстрее, чем полное — на свою', () => {
    const weak = { x: CLAW_MAX_SPEED * 0.2, y: 0 }
    const full = { x: CLAW_MAX_SPEED, y: 0 }

    expect(framesToTarget(weak)).toBeLessThan(framesToTarget(full))
  })

  it('держит направление отклонения на диагонали', () => {
    const diagonal = { x: CLAW_MAX_SPEED * 0.6, y: CLAW_MAX_SPEED * 0.6 }
    const velocity = advanceVelocity(REST, diagonal, FRAME_MS)

    expect(velocity.x).toBeCloseTo(velocity.y)
  })

  it('не превышает целевую скорость', () => {
    const target = { x: CLAW_MAX_SPEED, y: 0 }
    let velocity = REST

    for (let frames = 0; frames < 200; frames++) {
      velocity = advanceVelocity(velocity, target, FRAME_MS)

      expect(speedOf(velocity)).toBeLessThanOrEqual(CLAW_MAX_SPEED)
    }
  })

  it('останавливает клешню быстро и почти на месте', () => {
    const { frames, distance } = brake({ x: CLAW_MAX_SPEED, y: 0 })

    // Остановка укладывается в доли секунды и в треть ячейки пути
    expect(frames).toBeLessThan(15)
    expect(distance).toBeLessThan(0.35)
  })

  it('гасит остаток скорости, чтобы клешня не ползла', () => {
    const { distance } = brake({ x: 0.2, y: 0 })

    expect(distance).toBeLessThan(0.02)
  })
})
