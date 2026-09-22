import { describe, expect, it } from 'vitest'

import {
  CLAW_MAX_SPEED,
  MOTION_MIN_DURATION_SCALE,
  SWAY_DAMPING,
  SWAY_DRAG,
  SWAY_MAX_OFFSET,
  SWAY_PERIOD_MS,
  TOY_FALL_MS,
} from '#src/constants'
import type { GroundPoint, SpringOptions, SpringState, WorldPoint } from '#src/types'
import { advanceSpring, advanceVelocity, getMotionDurationScale, getMotionMs } from '#src/utils/motion'

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

describe('getMotionMs', () => {
  const AT = (x: number, y: number, z: number): WorldPoint => ({ x, y, z })

  it('отмеряет ход даже там, где спуска нет вовсе', () => {
    // Игрушку отпустили вровень с её местом: остаётся только переехать по полу
    expect(getMotionMs(1, AT(4, 4, 2), AT(4, 4, 2))).toBeGreaterThan(0)
    expect(getMotionMs(1, AT(4, 4, 2), AT(6, 4, 2))).toBeGreaterThan(0)
  })

  it('отмеряет ход снизу вверх так же, как спуск', () => {
    expect(getMotionMs(1, AT(4, 4, 1), AT(4, 4, 3))).toBe(getMotionMs(1, AT(4, 4, 3), AT(4, 4, 1)))
  })

  it('растёт с высотой спуска и с путём по полу', () => {
    expect(getMotionMs(1, AT(4, 4, 4), AT(4, 4, 0))).toBeGreaterThan(getMotionMs(1, AT(4, 4, 2), AT(4, 4, 0)))
    expect(getMotionMs(1, AT(0, 0, 0), AT(7, 7, 0))).toBeGreaterThan(getMotionMs(1, AT(0, 0, 0), AT(1, 0, 0)))
  })

  it('использует базовую скорость 90 мс на ячейку свободного падения', () => {
    expect(TOY_FALL_MS).toBe(90)
    expect(getMotionMs(1, AT(4, 4, 3), AT(4, 4, 0))).toBe(3 * TOY_FALL_MS)
  })

  it('роняет тяжёлое быстрее лёгкого, но лишь немного', () => {
    const light = getMotionMs(1, AT(4, 4, 4), AT(4, 4, 0))
    const heavy = getMotionMs(8, AT(4, 4, 4), AT(4, 4, 0))

    expect(heavy).toBeLessThan(light)
    expect(light / heavy).toBeLessThanOrEqual(1 / MOTION_MIN_DURATION_SCALE)
  })
})

describe('getMotionDurationScale', () => {
  it('держится между полом и единицей при любом весе', () => {
    for (const weight of [1, 2, 3, 4, 8, 64]) {
      expect(getMotionDurationScale(weight)).toBeLessThanOrEqual(1)
      expect(getMotionDurationScale(weight)).toBeGreaterThanOrEqual(MOTION_MIN_DURATION_SCALE)
    }
  })

  it('не ускоряет одноклеточную игрушку вовсе', () => {
    expect(getMotionDurationScale(1)).toBe(1)
  })
})
