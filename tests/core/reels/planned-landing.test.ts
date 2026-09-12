import { PlannedLandingStrategy } from 'src/core/reels/strategies/planned-landing'
import type { PlannedLandingOptions } from 'src/core/reels/strategies/types'
import type { LandingContext } from 'src/core/reels/types'
import { describe, expect, it } from 'vitest'

// Боевые параметры слота: высота ячейки нецелая (610 / 3), на ней и вылезают ошибки округления
const OPTIONS: PlannedLandingOptions = {
  speed: 60,
  deceleration: 2,
  handoverSpeed: 30,
  easeCells: 0.25,
  backStrength: 0.35,
  staggerCells: 2,
}

const ROWS = 3
const BUFFER = 1
const CELL_HEIGHT = 610 / 3
const STRIP_HEIGHT = (ROWS + BUFFER) * CELL_HEIGHT

// Стартовые позиции ленты: ноль, доли ячейки, точная граница и отрицательная сторона диапазона
const START_OFFSETS = [0, 1, CELL_HEIGHT / 3, CELL_HEIGHT / 2, CELL_HEIGHT, STRIP_HEIGHT - 0.001, -CELL_HEIGHT / 4]

const createContext = (
  fromOffset: number,
  index = 0,
  spunFrames = 0,
  anticipation = 0,
  anticipating = false
): LandingContext => ({
  index,
  order: index,
  rows: ROWS,
  buffer: BUFFER,
  cellHeight: CELL_HEIGHT,
  stripHeight: STRIP_HEIGHT,
  fromOffset,
  spunFrames,
  anticipation,
  anticipating,
})

/** Насколько лента промахнулась мимо ближайшей границы ячейки. */
const distanceToCellBorder = (position: number): number => {
  const rest = ((position % CELL_HEIGHT) + CELL_HEIGHT) % CELL_HEIGHT

  return Math.min(rest, CELL_HEIGHT - rest)
}

describe('PlannedLandingStrategy', () => {
  const strategy = new PlannedLandingStrategy(OPTIONS)

  it.each(START_OFFSETS)('сажает ленту на границу ячейки со старта %d', (fromOffset) => {
    const { distance } = strategy.plan(createContext(fromOffset))

    expect(distanceToCellBorder(fromOffset + distance)).toBeLessThan(1e-9)
  })

  it.each(START_OFFSETS)('прокручивает ленту хотя бы на полный оборот со старта %d', (fromOffset) => {
    // Оборот в дистанции — гарантия, что каждый слот обернётся и получит значение раунда
    const { distance } = strategy.plan(createContext(fromOffset))

    expect(distance).toBeGreaterThanOrEqual(STRIP_HEIGHT)
  })

  it('начинает расписание с нуля и заканчивает полной дистанцией', () => {
    const { distance, totalFrames, positionAt } = strategy.plan(createContext(0))

    expect(positionAt(0)).toBe(0)
    expect(positionAt(totalFrames)).toBeCloseTo(distance, 9)
  })

  it('ведёт ленту без разрывов на стыках участков', () => {
    // Расписание склеено из трёх кусков; рассогласование границ дало бы скачок позиции
    const { totalFrames, positionAt } = strategy.plan(createContext(0))
    const step = totalFrames / 5000

    let previous = positionAt(0)
    let maxJump = 0

    for (let frames = step; frames <= totalFrames; frames += step) {
      const position = positionAt(frames)

      maxJump = Math.max(maxJump, Math.abs(position - previous))
      previous = position
    }

    // Быстрее равномерного участка лента не идёт нигде, кроме погрешности выборки
    expect(maxJump).toBeLessThan(OPTIONS.speed * step * 1.01)
  })

  it('забрасывает ленту за точку посадки и возвращает её обратно', () => {
    const { distance, totalFrames, positionAt } = strategy.plan(createContext(0))
    const step = totalFrames / 5000

    let peak = 0

    for (let frames = 0; frames <= totalFrames; frames += step) {
      peak = Math.max(peak, positionAt(frames))
    }

    expect(peak).toBeGreaterThan(distance)
  })

  it.each([0, 10, 29, 30, 60])('не начинает торможение раньше минимума вращения, если до посадки прошло %d кадров', (spunFrames) => {
    const minSpinFrames = 30
    const brakeFrames = (OPTIONS.speed - OPTIONS.handoverSpeed) / OPTIONS.deceleration
    const { settleFrames } = new PlannedLandingStrategy({ ...OPTIONS, minSpinFrames }).plan(
      createContext(0, 0, spunFrames)
    )

    // Торможение кончается на settleFrames, значит начинается за brakeFrames до него
    expect(spunFrames + settleFrames - brakeFrames).toBeGreaterThanOrEqual(minSpinFrames - 1e-9)
  })

  it('оставляет после точки промотки только хвост отскока', () => {
    const { distance, settleFrames, positionAt } = strategy.plan(createContext(0))

    expect(distance - positionAt(settleFrames)).toBeCloseTo(OPTIONS.easeCells * CELL_HEIGHT, 9)
  })

  it('разносит остановку барабанов лесенкой', () => {
    const distances = [0, 1, 2, 3, 4].map((index) => strategy.plan(createContext(0, index)).distance)

    distances.slice(1).forEach((distance, previousIndex) => {
      expect(distance - distances[previousIndex]).toBeCloseTo(OPTIONS.staggerCells * CELL_HEIGHT, 9)
    })
  })

  it.each([1, 2, 3])('удлиняет круиз на %d паузы anticipation, не трогая торможение и отскок', (anticipation) => {
    const anticipationCells = 10
    const withAnticipation = new PlannedLandingStrategy({ ...OPTIONS, anticipationCells })
    const base = withAnticipation.plan(createContext(0))
    const delayed = withAnticipation.plan(createContext(0, 0, 0, anticipation))
    const extraDistance = anticipation * anticipationCells * CELL_HEIGHT

    expect(delayed.distance - base.distance).toBeCloseTo(extraDistance, 9)
    // Добавка целиком на равномерном участке: slam проматывает её вместе с ним
    expect(delayed.settleFrames - base.settleFrames).toBeCloseTo(extraDistance / OPTIONS.speed, 9)
    expect(delayed.totalFrames - delayed.settleFrames).toBeCloseTo(base.totalFrames - base.settleFrames, 9)
  })

  it('начинает собственную паузу в кадре, где без неё барабан встал бы', () => {
    const withAnticipation = new PlannedLandingStrategy({ ...OPTIONS, anticipationCells: 10 })
    const own = withAnticipation.plan(createContext(0, 3, 0, 2, true))
    const withoutOwn = withAnticipation.plan(createContext(0, 3, 0, 1, false))

    expect(own.anticipationFrames).toBeCloseTo(withoutOwn.totalFrames, 9)
    // Барабан, сдвинутый только соседями слева, своей паузы не объявляет
    expect(withoutOwn.anticipationFrames).toBeUndefined()
  })
})
