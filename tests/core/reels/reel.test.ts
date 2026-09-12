import { PlannedLandingStrategy } from 'src/core/reels/strategies/planned-landing'
import { ReelPhase } from 'src/core/reels/types'
import { describe, expect, it } from 'vitest'

import {
  advanceUntilIdle,
  CELL_HEIGHT,
  createGrid,
  createMachine,
  LANDING_OPTIONS,
  readVisibleGrid,
  REELS,
  type TestData,
} from '../../setup/reels'

/** Насколько слот промахнулся мимо ближайшей границы ячейки. */
const distanceToCellBorder = (position: number): number => {
  const rest = ((position % CELL_HEIGHT) + CELL_HEIGHT) % CELL_HEIGHT

  return Math.min(rest, CELL_HEIGHT - rest)
}

const ANTICIPATION_CELLS = 18

/** Машина с паузами anticipation: стратегии фиксируются на старте спина, поэтому ставятся до него. */
const createAnticipationMachine = () => {
  const machine = createMachine()

  machine.setStrategies({
    ...machine.getStrategies(),
    landingStrategy: new PlannedLandingStrategy({ ...LANDING_OPTIONS, anticipationCells: ANTICIPATION_CELLS }),
  })

  return machine
}

/**
 * Крутит машину до покоя и отдаёт кадр, на котором встал каждый барабан.
 * `clock` показывает текущий кадр колбэкам модели, которые приходят посреди `advance`.
 */
const recordStopFrames = (machine: ReturnType<typeof createMachine>, clock = { frame: 0 }): number[] => {
  const stopFrames = machine.getReels().map(() => 0)

  for (let frame = 1; machine.getPhase() !== ReelPhase.idle; frame += 1) {
    clock.frame = frame
    machine.advance(1)

    machine.getReels().forEach((reel, index) => {
      if (reel.getPhase() === ReelPhase.idle && stopFrames[index] === 0) stopFrames[index] = frame
    })
  }

  return stopFrames
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

    const landing = machine.land({ signal: controller.signal })

    machine.advance(5)
    controller.abort(new Error('round cancelled'))

    await expect(landing).rejects.toThrow('round cancelled')
    expect(machine.getPhase()).toBe(ReelPhase.idle)
  })

  it('объявляет посадку каждого барабана по лесенке', async () => {
    const machine = createMachine()
    const landed: number[] = []

    machine.spin()
    machine.advance(25)
    machine.setData(createGrid())

    const landing = machine.land({ onReelLanded: (reel) => landed.push(reel) })

    advanceUntilIdle(machine)
    await landing

    expect(landed).toEqual(Array.from({ length: REELS }, (_, reel) => reel))
  })

  it('не объявляет посадку, прерванную отменой', async () => {
    const machine = createMachine()
    const controller = new AbortController()
    const landed: number[] = []

    machine.spin()
    machine.advance(10)

    const landing = machine.land({ signal: controller.signal, onReelLanded: (reel) => landed.push(reel) })

    machine.advance(5)
    controller.abort(new Error('round cancelled'))

    await expect(landing).rejects.toThrow('round cancelled')
    expect(landed).toEqual([])
  })

  it.each([0, 5, 20, 40, 60])('после slam на %d-м кадре посадки сажает ленту на значения раунда', async (landingFrames) => {
    const grid = createGrid()
    const machine = createMachine()

    machine.spin()
    machine.advance(25)
    machine.setData(grid)

    const landing = machine.land()

    for (let frame = 0; frame < landingFrames; frame += 1) {
      machine.advance(1)
    }

    machine.slam()
    advanceUntilIdle(machine)
    await landing

    expect(readVisibleGrid(machine)).toEqual(grid)
  })

  it.each([[[]], [[3, 4]]])('после slam сажает все барабаны в один кадр, anticipation %j', (anticipation) => {
    const machine = createAnticipationMachine()
    const anticipated: number[] = []

    machine.spin()
    machine.advance(25)
    machine.setData(createGrid())
    void machine.land({ anticipation, onReelAnticipated: (reel) => anticipated.push(reel) })
    machine.slam()

    expect(new Set(recordStopFrames(machine)).size).toBe(1)
    // Промотанная пауза не начиналась: объявлять нечего
    expect(anticipated).toEqual([])
  })

  it('объявляет вход в паузу только ждущим барабанам, через лесенку после посадки соседа слева', () => {
    const machine = createAnticipationMachine()
    const clock = { frame: 0 }
    const anticipated: { reel: number; frame: number }[] = []

    machine.spin()
    machine.advance(25)
    machine.setData(createGrid())
    void machine.land({
      anticipation: [3, 4],
      onReelAnticipated: (reel) => anticipated.push({ reel, frame: clock.frame }),
    })

    const stopFrames = recordStopFrames(machine, clock)
    const staggerFrames = (LANDING_OPTIONS.staggerCells * CELL_HEIGHT) / LANDING_OPTIONS.speed

    expect(anticipated.map(({ reel }) => reel)).toEqual([3, 4])

    // Пауза начинается там, где барабан встал бы без неё: на лесенку позже соседа слева
    anticipated.forEach(({ reel, frame }) => {
      expect(Math.abs(frame - stopFrames[reel - 1] - staggerFrames)).toBeLessThanOrEqual(1)
      expect(frame).toBeLessThan(stopFrames[reel])
    })
  })

  it('сажает барабаны anticipation по очереди, с паузой сверх лесенки, на значения раунда', () => {
    const grid = createGrid()
    const machine = createAnticipationMachine()

    machine.spin()
    machine.advance(25)
    machine.setData(grid)
    void machine.land({ anticipation: [3, 4] })

    const stopFrames = recordStopFrames(machine)
    const gaps = stopFrames.slice(1).map((frame, previousIndex) => frame - stopFrames[previousIndex])
    const pauseFrames = (ANTICIPATION_CELLS * CELL_HEIGHT) / LANDING_OPTIONS.speed

    // До барабана anticipation — обычная лесенка, перед каждым ждущим — лесенка плюс пауза
    // Кадр остановки целый: допуск — один кадр
    expect(Math.abs(gaps[2] - gaps[1] - pauseFrames)).toBeLessThanOrEqual(1)
    expect(Math.abs(gaps[3] - gaps[1] - pauseFrames)).toBeLessThanOrEqual(1)
    expect(readVisibleGrid(machine)).toEqual(grid)
  })

  it('держит барабан за anticipation после ждущего соседа, даже если сам он не ждёт', () => {
    const machine = createAnticipationMachine()

    machine.spin()
    machine.advance(25)
    machine.setData(createGrid())
    void machine.land({ anticipation: [2] })

    const stopFrames = recordStopFrames(machine)

    expect(stopFrames[3]).toBeGreaterThan(stopFrames[2])
    expect(stopFrames[4]).toBeGreaterThan(stopFrames[3])
  })

  it('не трогает удержанные барабаны и сажает остальные на данные шага', async () => {
    const held = [1, 3]
    const board = createGrid()
    // Сервер повторяет удержанные колонки, остальные получают новые значения
    const step = board.map((column, reel) => (held.includes(reel) ? column : column.map((value) => `next-${value}`)))
    const machine = createMachine()
    const landed: number[] = []

    machine.setData(board)
    machine.reset()

    const heldStrips = held.map((reel) => machine.getReel(reel)?.getStrip().map((slot) => ({ ...slot })))

    machine.spin({ held })
    machine.advance(25)
    machine.setData(step)

    const landing = machine.land({ onReelLanded: (reel) => landed.push(reel) })

    advanceUntilIdle(machine)
    await landing

    expect(readVisibleGrid(machine)).toEqual(step)
    expect(held.map((reel) => machine.getReel(reel)?.getStrip())).toEqual(heldStrips)
    // Удержанный барабан не садился: объявлять его посадку нечего
    expect(landed).toEqual([0, 2, 4])
  })

  it('начинает лесенку с первого крутящегося барабана', () => {
    const baseline = createMachine()
    const heldMachine = createMachine()

    baseline.spin()
    heldMachine.spin({ held: [0, 1] })

    const [baselineStops, heldStops] = [baseline, heldMachine].map((machine) => {
      machine.advance(25)
      machine.setData(createGrid())
      void machine.land()

      return recordStopFrames(machine)
    })

    expect(heldStops[2]).toBe(baselineStops[0])
    expect(heldStops[3]).toBe(baselineStops[1])
  })

  it('не меняет движение текущего раунда при смене стратегий посреди спина', async () => {
    const grid = createGrid()
    const baseline = createMachine()
    const switched = createMachine()

    for (const machine of [baseline, switched]) {
      machine.spin()
      machine.advance(25)
    }

    // Вторая машина получает стратегии без лесенки: на текущей посадке это не должно сказаться
    switched.setStrategies({
      ...switched.getStrategies(),
      landingStrategy: new PlannedLandingStrategy({ ...LANDING_OPTIONS, staggerCells: 0 }),
    })

    const frames = [baseline, switched].map((machine) => {
      machine.setData(grid)
      void machine.land()

      return advanceUntilIdle(machine)
    })

    expect(frames[1]).toBe(frames[0])
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
