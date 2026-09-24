import { describe, expect, it } from 'vitest'

import { CLAW_MAX_SPEED, SWAY_DAMPING, SWAY_DRAG, SWAY_MAX_OFFSET, SWAY_PERIOD_MS } from '#src/claw/constants'
import type { SpringOptions, SpringState } from '#src/claw/types'
import { advanceSpring, advanceVelocity } from '#src/claw/utils'
import { lerpPose } from '#src/heap/utils'
import type { GroundPoint } from '#src/types'

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
    expect(framesToTarget(full)).toBeGreaterThan(3)
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

const SWAY: SpringOptions = { target: 0, periodMs: SWAY_PERIOD_MS, damping: SWAY_DAMPING }

/** Прогоняет пружину `frames` кадров и отдаёт её состояние и наибольшее отклонение по дороге. */
const runSpring = (
  state: SpringState,
  frames: number,
  frameMs = FRAME_MS
): { state: SpringState; peak: number } => {
  let current = state
  let peak = Math.abs(state.value - SWAY.target)

  for (let frame = 0; frame < frames; frame++) {
    current = advanceSpring(current, SWAY, frameMs)
    peak = Math.max(peak, Math.abs(current.value - SWAY.target))
  }

  return { state: current, peak }
}

describe('advanceSpring', () => {
  it('держит пружину в покое, пока её не толкнули', () => {
    const { state } = runSpring({ value: 0, velocity: 0 }, 10)

    expect(state).toEqual({ value: 0, velocity: 0 })
  })

  it('уводит пружину в сторону толчка и возвращает к цели', () => {
    const pushed = advanceSpring({ value: 0, velocity: -2 }, SWAY, FRAME_MS)

    expect(pushed.value).toBeLessThan(0)

    // Затухание съедает отклонение за несколько периодов
    const { state } = runSpring({ value: 0, velocity: -2 }, Math.ceil((4 * SWAY_PERIOD_MS) / FRAME_MS))

    expect(state).toEqual({ value: 0, velocity: 0 })
  })

  it('не разгоняется на предельном шаге тикера', () => {
    // PIXI отдаёт кадр длиной до 100 мс: на нём явная схема разошлась бы
    const rough = runSpring({ value: 0, velocity: -2 }, 40, 100)
    const fine = runSpring({ value: 0, velocity: -2 }, 40 * 6, 100 / 6)

    expect(rough.peak).toBeLessThanOrEqual(fine.peak * 1.5)
    expect(rough.state).toEqual({ value: 0, velocity: 0 })
  })
})

/** Кадр качания клешни: цель — отклонение против хода каретки, пружина её догоняет. */
const advanceSway = (state: SpringState, velocity: number): SpringState => {
  const drag = -velocity * SWAY_DRAG
  const target = Math.sign(drag) * Math.min(Math.abs(drag), SWAY_MAX_OFFSET)

  return advanceSpring(state, { ...SWAY, target }, FRAME_MS)
}

/** Сколько кадров хватает, чтобы качание улеглось: несколько периодов маятника. */
const SETTLE_FRAMES = Math.ceil((4 * SWAY_PERIOD_MS) / FRAME_MS)

describe('качание клешни', () => {
  it('отклоняет клешню против хода, держит отклонение на ровном ходу и гасит после остановки', () => {
    const full = { x: CLAW_MAX_SPEED, y: 0 }
    let velocity = REST
    let swing: SpringState = { value: 0, velocity: 0 }
    let peak = 0

    const drive = (target: GroundPoint, frames: number): void => {
      for (let frame = 0; frame < frames; frame++) {
        velocity = advanceVelocity(velocity, target, FRAME_MS)
        swing = advanceSway(swing, velocity.x)
        peak = Math.max(peak, swing.value)
      }
    }

    // Каретка идёт вперёд — клешня отстаёт назад
    drive(full, 6)
    expect(swing.value).toBeLessThan(0)

    // На ровном ходу отклонение замирает на своей цели, а не возвращается под каретку
    drive(full, SETTLE_FRAMES)
    expect(swing.value).toBeCloseTo(-CLAW_MAX_SPEED * SWAY_DRAG, 3)

    // После остановки клешня проходит через отвес вперёд и успокаивается под кареткой
    peak = 0
    drive(REST, SETTLE_FRAMES)
    expect(peak).toBeGreaterThan(0)
    expect(Math.abs(swing.value)).toBe(0)
    expect(swing.velocity).toBe(0)
  })

  it('не уводит клешню дальше предела', () => {
    const swing = advanceSway({ value: 0, velocity: 0 }, 100 * CLAW_MAX_SPEED)

    expect(Math.abs(swing.value)).toBeLessThanOrEqual(SWAY_MAX_OFFSET)
  })
})

describe('lerpPose', () => {
  it('ведёт крен по кратчайшей дуге через переход угла от π к −π', () => {
    const from = { y: 1, z: 2, angle: Math.PI - 0.1 }
    const to = { y: 3, z: 4, angle: -Math.PI + 0.1 }
    const middle = lerpPose(from, to, 0.5)

    expect(middle.y).toBe(2)
    expect(middle.z).toBe(3)
    expect(Math.cos(middle.angle)).toBeCloseTo(-1, 12)
  })

  it('совпадает с концами отрезка на долях 0 и 1', () => {
    const from = { y: 0.5, z: 1.5, angle: 7 }
    const to = { y: 2.5, z: 0.5, angle: 7.2 }

    expect(lerpPose(from, to, 0)).toEqual(from)
    expect(lerpPose(from, to, 1).angle).toBeCloseTo(to.angle, 12)
  })
})
