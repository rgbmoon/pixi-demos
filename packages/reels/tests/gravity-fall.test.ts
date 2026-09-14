import { describe, expect, it } from 'vitest'

import { GravityFallStrategy } from '#src/strategies/gravity-fall'
import type { FallContext, FallDrop } from '#src/types'

import { BUFFER, CELL_HEIGHT, FALL_OPTIONS, ROWS, STRIP_HEIGHT } from './setup/reels'

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
})
