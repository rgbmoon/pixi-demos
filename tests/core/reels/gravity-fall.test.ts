import { GravityFallStrategy } from 'src/core/reels/strategies/gravity-fall'
import type { FallContext, FallDrop } from 'src/core/reels/types'
import { describe, expect, it } from 'vitest'

import { BUFFER, CELL_HEIGHT, FALL_OPTIONS, ROWS, STRIP_HEIGHT } from '../../setup/reels'

/** Шаг выборки расписания, кадров: мельче кадра, чтобы не проскочить границы участков. */
const SAMPLE_STEP = 0.25

const strategy = new GravityFallStrategy(FALL_OPTIONS)

// Колонка с убранными рядами 0 и 2: уцелевший ряд 1 падает на ряд 2, два новых — на ряды 0 и 1
const DROPS: FallDrop[] = [
  { row: 2, distance: CELL_HEIGHT },
  { row: 0, distance: 2 * CELL_HEIGHT },
  { row: 1, distance: 2 * CELL_HEIGHT },
]

const createContext = (order = 0, drops = DROPS): FallContext => ({
  index: order,
  order,
  rows: ROWS,
  buffer: BUFFER,
  cellHeight: CELL_HEIGHT,
  stripHeight: STRIP_HEIGHT,
  drops,
})

/** Первый кадр выборки, на котором слот сдвинулся с места. */
const findStartFrame = (positionAt: (frames: number) => number): number => {
  let frames = 0

  while (positionAt(frames) === 0) frames += SAMPLE_STEP

  return frames
}

describe('GravityFallStrategy', () => {
  it('доводит каждый слот ровно до его ряда к концу расписания', () => {
    const plan = strategy.plan(createContext())

    DROPS.forEach((drop, index) => {
      expect(plan.positionAt(index, plan.totalFrames)).toBe(drop.distance)
    })
  })

  it('ведёт слот вниз без возвратов до касания ряда', () => {
    const plan = strategy.plan(createContext())
    const bounce = (FALL_OPTIONS.bounceCells ?? 0) * CELL_HEIGHT

    DROPS.forEach((drop, index) => {
      let previous = 0

      // Отскок держит слот не выше `distance - bounce`: до этой отметки идёт только падение
      for (let frames = 0; previous < drop.distance - bounce; frames += SAMPLE_STEP) {
        const position = plan.positionAt(index, frames)

        expect(position).toBeGreaterThanOrEqual(previous)
        previous = position
      }
    })
  })

  it('к кадру промотки держит все слоты у рядов с точностью до отскока', () => {
    const plan = strategy.plan(createContext())
    const bounce = (FALL_OPTIONS.bounceCells ?? 0) * CELL_HEIGHT

    expect(plan.settleFrames).toBeLessThanOrEqual(plan.totalFrames)

    DROPS.forEach((drop, index) => {
      for (let frames = plan.settleFrames; frames <= plan.totalFrames; frames += SAMPLE_STEP) {
        expect(plan.positionAt(index, frames)).toBeGreaterThanOrEqual(drop.distance - bounce - 1e-9)
      }
    })
  })

  it('запускает нижний слот колонки не позже верхнего', () => {
    const plan = strategy.plan(createContext())
    const startFrames = DROPS.map((_, index) => findStartFrame((frames) => plan.positionAt(index, frames)))
    const byRow = DROPS.map((drop, index) => ({ row: drop.row, start: startFrames[index] })).sort(
      (a, b) => b.row - a.row
    )

    for (let index = 1; index < byRow.length; index += 1) {
      expect(byRow[index].start).toBeGreaterThanOrEqual(byRow[index - 1].start)
    }
  })

  it('сдвигает следующий барабан лесенки позже предыдущего', () => {
    const first = strategy.plan(createContext(0))
    const second = strategy.plan(createContext(1))

    expect(findStartFrame((frames) => second.positionAt(0, frames))).toBeGreaterThan(
      findStartFrame((frames) => first.positionAt(0, frames))
    )
    expect(second.totalFrames).toBeGreaterThan(first.totalFrames)
  })
})
