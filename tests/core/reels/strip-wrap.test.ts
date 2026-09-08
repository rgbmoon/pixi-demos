import { getLap, wrapOffset } from 'src/core/reels/utils'
import { describe, expect, it } from 'vitest'

import {
  advanceUntilIdle,
  BUFFER,
  CELL_HEIGHT,
  createGrid,
  createMachine,
  readVisibleGrid,
  STRIP_HEIGHT,
} from '../../setup/reels'

const MIN = -BUFFER * CELL_HEIGHT

/**
 * Точка покоя слота может попасть ровно на границу диапазона ленты, и с какой её стороны
 * окажется результат `%`, решает порядок ошибок округления: слот паркуется под зоной вместо
 * буфера над ней, а соответствие «слот → ряд» смещается на единицу.
 */
describe('свёртка ленты', () => {
  it('сажает ленту верно с любой стартовой позиции', async () => {
    const grid = createGrid()
    const misses: number[] = []

    for (let spinFrames = 1; spinFrames <= 400; spinFrames += 1) {
      const machine = createMachine()

      machine.spin()
      // Дробный шаг разносит стартовую позицию посадки по всему диапазону ленты
      machine.advance(spinFrames * 0.37)
      machine.setData(grid)

      const landing = machine.land()

      advanceUntilIdle(machine)
      await landing

      if (JSON.stringify(readVisibleGrid(machine)) !== JSON.stringify(grid)) misses.push(spinFrames)
    }

    expect(misses).toEqual([])
  })

  it('складывает позицию на верхней границе в начало диапазона', () => {
    expect(wrapOffset(MIN + STRIP_HEIGHT, MIN, STRIP_HEIGHT)).toBeCloseTo(MIN, 9)
    expect(wrapOffset(MIN, MIN, STRIP_HEIGHT)).toBeCloseTo(MIN, 9)
  })

  it('меняет круг ровно там же, где сворачивает позицию', () => {
    // Круг и позиция обязаны решать про границу одинаково, иначе слот получит значение не своего ряда
    const step = STRIP_HEIGHT / 500
    const wrapPoints: number[] = []
    const lapPoints: number[] = []

    let previousOffset = wrapOffset(MIN, MIN, STRIP_HEIGHT)
    let previousLap = getLap(MIN, MIN, STRIP_HEIGHT)

    for (let index = 1; index <= 1000; index += 1) {
      const position = MIN + index * step
      const offset = wrapOffset(position, MIN, STRIP_HEIGHT)
      const lap = getLap(position, MIN, STRIP_HEIGHT)

      if (offset < previousOffset) wrapPoints.push(index)
      if (lap !== previousLap) lapPoints.push(index)

      previousOffset = offset
      previousLap = lap
    }

    expect(wrapPoints).toEqual(lapPoints)
  })
})
