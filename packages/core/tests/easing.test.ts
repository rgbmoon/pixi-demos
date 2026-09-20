import { describe, expect, it } from 'vitest'

import { easeTrapezoid, easeTrapezoidInverse } from '#src/easing'

const RAMP = 0.2

/** Скорость профиля на отрезке вокруг `progress`, в долях средней скорости. */
const speedAt = (progress: number, ramp = RAMP): number => {
  const step = 0.001

  return (easeTrapezoid(progress + step, ramp) - easeTrapezoid(progress - step, ramp)) / (2 * step)
}

describe('easeTrapezoid', () => {
  it('проходит путь от нуля до единицы', () => {
    expect(easeTrapezoid(0, RAMP)).toBeCloseTo(0)
    expect(easeTrapezoid(1, RAMP)).toBeCloseTo(1)
  })

  it('держит скорость постоянной между разгоном и торможением', () => {
    const peak = 1 / (1 - RAMP)

    expect(speedAt(0.4)).toBeCloseTo(peak)
    expect(speedAt(0.5)).toBeCloseTo(peak)
    expect(speedAt(0.6)).toBeCloseTo(peak)
  })

  it('трогается и останавливается медленнее, чем идёт в середине', () => {
    expect(speedAt(RAMP / 2)).toBeLessThan(speedAt(0.5))
    expect(speedAt(1 - RAMP / 2)).toBeLessThan(speedAt(0.5))
    // Профиль симметричен: разгон и торможение зеркальны
    expect(speedAt(RAMP / 2)).toBeCloseTo(speedAt(1 - RAMP / 2))
  })

  it('чем короче разгон, тем ближе ход к равномерному', () => {
    expect(speedAt(0.5, 0.1)).toBeLessThan(speedAt(0.5, 0.4))
  })

  it('не убывает на всём пути', () => {
    for (let step = 1; step <= 20; step++) {
      expect(easeTrapezoid(step / 20, RAMP)).toBeGreaterThan(easeTrapezoid((step - 1) / 20, RAMP))
    }
  })
})

describe('easeTrapezoidInverse', () => {
  it('обращает профиль на всём ходе', () => {
    for (let step = 0; step <= 20; step++) {
      const distance = step / 20

      expect(easeTrapezoid(easeTrapezoidInverse(distance, RAMP), RAMP)).toBeCloseTo(distance)
    }
  })

  it('обращает профиль при любой доле разгона', () => {
    for (const ramp of [0, 0.05, 0.15, 0.5]) {
      for (const distance of [0.1, 0.5, 0.9]) {
        expect(easeTrapezoid(easeTrapezoidInverse(distance, ramp), ramp)).toBeCloseTo(distance)
      }
    }
  })

  it('отдаёт долю длительности в пределах хода', () => {
    expect(easeTrapezoidInverse(0, RAMP)).toBeCloseTo(0)
    expect(easeTrapezoidInverse(1, RAMP)).toBeCloseTo(1)
    expect(easeTrapezoidInverse(-1, RAMP)).toBeCloseTo(0)
    expect(easeTrapezoidInverse(2, RAMP)).toBeCloseTo(1)
  })

  it('отстаёт от линейного отсчёта на разгоне и опережает на торможении', () => {
    // Привод ещё набирает скорость, поэтому четверть пути занимает больше четверти времени
    expect(easeTrapezoidInverse(0.25, RAMP)).toBeGreaterThan(0.25)
    expect(easeTrapezoidInverse(0.75, RAMP)).toBeLessThan(0.75)
  })
})
