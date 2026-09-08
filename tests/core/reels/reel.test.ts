import { ReelPhase } from 'src/core/reels/types'
import { describe, expect, it } from 'vitest'

import {
  advanceUntilIdle,
  CELL_HEIGHT,
  createGrid,
  createMachine,
  readVisibleGrid,
  type TestData,
} from '../../setup/reels'

/** Насколько слот промахнулся мимо ближайшей границы ячейки. */
const distanceToCellBorder = (position: number): number => {
  const rest = ((position % CELL_HEIGHT) + CELL_HEIGHT) % CELL_HEIGHT

  return Math.min(rest, CELL_HEIGHT - rest)
}

/** Прогоняет полный раунд барабанов: прокрутка, посадка на данные, остановка. */
const playRound = async (grid: TestData, spinFrames = 25, deltaFrames = 1) => {
  const machine = createMachine()

  machine.spin()

  for (let frame = 0; frame < spinFrames; frame += 1) {
    machine.advance(deltaFrames)
  }

  machine.setData(grid)

  const landing = machine.land()

  advanceUntilIdle(machine, deltaFrames)
  await landing

  return machine
}

describe('Reel', () => {
  it('сажает ленту на значения раунда', async () => {
    const grid = createGrid()
    const machine = await playRound(grid)

    expect(readVisibleGrid(machine)).toEqual(grid)
  })

  it('оставляет слоты на границах ячеек', async () => {
    const machine = await playRound(createGrid())

    machine.getReels().forEach((reel) => {
      reel.getStrip().forEach((slot) => {
        expect(distanceToCellBorder(slot.offset)).toBeLessThan(1e-9)
      })
    })
  })

  it('возвращает барабаны в покой и гасит движение слотов', async () => {
    const machine = await playRound(createGrid())

    expect(machine.getPhase()).toBe(ReelPhase.idle)

    machine.getReels().forEach((reel) => {
      reel.getCells().forEach((cell) => {
        expect(cell.getSlot()?.moving).toBe(false)
      })
    })
  })

  it('резолвит посадку сразу, если барабаны не крутятся', async () => {
    const machine = createMachine()

    await expect(machine.land()).resolves.toBeUndefined()
    expect(machine.getPhase()).toBe(ReelPhase.idle)
  })

  it('реджектит посадку по отмене и возвращает барабаны в покой', async () => {
    const machine = createMachine()
    const controller = new AbortController()

    machine.spin()
    machine.advance(10)

    const landing = machine.land(controller.signal)

    machine.advance(5)
    controller.abort(new Error('round cancelled'))

    await expect(landing).rejects.toThrow('round cancelled')
    expect(machine.getPhase()).toBe(ReelPhase.idle)
  })

  it('садится одинаково при любом размере шага', async () => {
    const grid = createGrid()
    // Одинаковый путь до посадки: 25 кадров по 1 против 50 по 0.5
    const coarse = await playRound(grid, 25, 1)
    const fine = await playRound(grid, 50, 0.5)

    expect(readVisibleGrid(fine)).toEqual(readVisibleGrid(coarse))

    fine.getReels().forEach((reel, index) => {
      const expected = coarse.getReels()[index].getStrip()

      reel.getStrip().forEach((slot, slotIndex) => {
        expect(slot.offset).toBeCloseTo(expected[slotIndex].offset, 9)
      })
    })
  })
})
