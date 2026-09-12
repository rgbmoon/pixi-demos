import type { CellIndex } from 'src/core/reels/types'
import { ReelPhase } from 'src/core/reels/types'
import { describe, expect, it } from 'vitest'

import {
  advanceUntilIdle,
  BUFFER,
  CELL_HEIGHT,
  createGrid,
  createMachine,
  FALL_OPTIONS,
  readVisibleGrid,
  REELS,
  ROWS,
  type TestData,
} from '../../setup/reels'

type Machine = ReturnType<typeof createMachine>

/** Убранные ячейки: разные барабаны, разные ряды, барабан без убранных, барабан убран целиком. */
const REMOVED: CellIndex[] = [
  { reel: 0, row: 1 },
  { reel: 2, row: 0 },
  { reel: 2, row: 2 },
  { reel: 3, row: 2 },
  { reel: 4, row: 0 },
  { reel: 4, row: 1 },
  { reel: 4, row: 2 },
]

/** Кадр после каскада: уцелевшие символы колонки опускаются, сверху встают новые `n<барабан>c<ряд>`. */
const applyCascade = (grid: TestData, removed: readonly CellIndex[]): TestData =>
  grid.map((column, reel) => {
    const survivors = column.filter((_, row) => !removed.some((cell) => cell.reel === reel && cell.row === row))
    const fresh = Array.from({ length: ROWS - survivors.length }, (_, row) => `n${reel}c${row}`)

    return [...fresh, ...survivors]
  })

/** Насколько слот промахнулся мимо ближайшей границы ячейки. */
const distanceToCellBorder = (position: number): number => {
  const rest = ((position % CELL_HEIGHT) + CELL_HEIGHT) % CELL_HEIGHT

  return Math.min(rest, CELL_HEIGHT - rest)
}

/** Прокрутка и посадка машины на сетку. */
const landOn = async (machine: Machine, grid: TestData, deltaFrames = 1) => {
  machine.spin()

  for (let frame = 0; frame < 25; frame += 1) {
    machine.advance(deltaFrames)
  }

  machine.setData(grid)

  const landing = machine.land()

  advanceUntilIdle(machine, deltaFrames)
  await landing
}

/** Каскад по кадру до полной остановки. */
const cascadeTo = async (machine: Machine, frame: TestData, removed = REMOVED, deltaFrames = 1) => {
  machine.setData(frame)

  const falling = machine.cascade({ removed })

  advanceUntilIdle(machine, deltaFrames)
  await falling
}

/** Машина, севшая на стартовую сетку. */
const createLandedMachine = async (deltaFrames = 1) => {
  const machine = createMachine()

  await landOn(machine, createGrid(), deltaFrames)

  return machine
}

describe('каскад', () => {
  it('сажает ячейки на кадр каскада', async () => {
    const machine = await createLandedMachine()
    const frame = applyCascade(createGrid(), REMOVED)

    await cascadeTo(machine, frame)

    expect(readVisibleGrid(machine)).toEqual(frame)
  })

  it('опускает уцелевший символ тем же слотом, а не новым значением', async () => {
    const machine = await createLandedMachine()
    const slotId = (index: CellIndex) => machine.getCell(index)?.getSlot()?.id
    // На барабане 2 убраны ряды 0 и 2: символ ряда 1 падает на ряд 2
    const survivor = slotId({ reel: 2, row: 1 })

    await cascadeTo(machine, applyCascade(createGrid(), REMOVED))

    expect(slotId({ reel: 2, row: 2 })).toBe(survivor)
  })

  it('оставляет слоты на границах ячеек, по одному на каждую позицию ленты', async () => {
    const machine = await createLandedMachine()

    await cascadeTo(machine, applyCascade(createGrid(), REMOVED))

    const positions = Array.from({ length: ROWS + BUFFER }, (_, index) => (index - BUFFER) * CELL_HEIGHT)

    machine.getReels().forEach((reel) => {
      const offsets = reel.getStrip().map((slot) => slot.offset)

      offsets.forEach((offset) => expect(distanceToCellBorder(offset)).toBeLessThan(1e-9))
      expect([...offsets].sort((a, b) => a - b)).toEqual(positions)
    })
  })

  it('после каскада сажает следующий спин ровно на его сетку', async () => {
    const machine = await createLandedMachine()

    await cascadeTo(machine, applyCascade(createGrid(), REMOVED))

    // Буквы вместо цифр: ни одно значение не совпадает с прошлым раундом
    const next = createGrid().map((column) => column.map((value) => value.toUpperCase()))

    await landOn(machine, next)

    expect(readVisibleGrid(machine)).toEqual(next)
    machine.getReels().forEach((reel) => {
      reel.getStrip().forEach((slot) => expect(distanceToCellBorder(slot.offset)).toBeLessThan(1e-9))
    })
  })

  it('даёт тот же результат при любом шаге модели', async () => {
    const frame = applyCascade(createGrid(), REMOVED)
    const readIds = (machine: Machine) =>
      machine.getReels().map((reel) => reel.getCells().map((cell) => cell.getSlot()?.id))

    /** Из какого ряда до каскада пришёл слот каждой ячейки: перестановка слотов не зависит от шага. */
    const traceSources = async (deltaFrames: number) => {
      const machine = await createLandedMachine(deltaFrames)
      const before = readIds(machine)

      await cascadeTo(machine, frame, REMOVED, deltaFrames)

      expect(readVisibleGrid(machine)).toEqual(frame)

      return readIds(machine).map((column, reel) => column.map((id) => before[reel].indexOf(id)))
    }

    expect(await traceSources(2.5)).toEqual(await traceSources(0.7))
  })

  it('не даёт слотам колонки заходить друг на друга дальше отскока', async () => {
    const machine = await createLandedMachine()
    const bounce = (FALL_OPTIONS.bounceCells ?? 0) * CELL_HEIGHT
    const frames: number[][][] = []

    machine.setData(applyCascade(createGrid(), REMOVED))

    const falling = machine.cascade({ removed: REMOVED })

    while (machine.getPhase() !== ReelPhase.idle) {
      machine.advance(1)
      frames.push(machine.getReels().map((reel) => reel.getStrip().map((slot) => slot.offset)))
    }

    await falling

    // Порядок колонки берём по итогу: в каждом кадре слот ряда ниже обязан лежать ниже слота ряда выше
    machine.getReels().forEach((reel, index) => {
      const column = reel.getVisibleSlotIndices()

      frames.forEach((offsets) => {
        for (let row = 1; row < column.length; row += 1) {
          const gap = offsets[index][column[row]] - offsets[index][column[row - 1]]

          expect(gap).toBeGreaterThanOrEqual(CELL_HEIGHT - bounce - 1e-9)
        }
      })
    })
  })

  it('по slam сажает раньше и на тот же кадр', async () => {
    const frame = applyCascade(createGrid(), REMOVED)
    const plain = await createLandedMachine()
    const slammed = await createLandedMachine()

    plain.setData(frame)
    slammed.setData(frame)

    const plainFalling = plain.cascade({ removed: REMOVED })
    const slammedFalling = slammed.cascade({ removed: REMOVED })

    slammed.advance(1)
    slammed.slam()

    const plainFrames = advanceUntilIdle(plain)
    const slammedFrames = advanceUntilIdle(slammed) + 1

    await Promise.all([plainFalling, slammedFalling])

    expect(slammedFrames).toBeLessThan(plainFrames)
    expect(readVisibleGrid(slammed)).toEqual(frame)
  })

  it('не трогает барабан без убранных ячеек и не объявляет его вставшим', async () => {
    const machine = await createLandedMachine()
    const untouched = machine.getReel(1)
    const revision = untouched?.getRevision()
    const landed: number[] = []

    machine.setData(applyCascade(createGrid(), REMOVED))

    const falling = machine.cascade({ removed: REMOVED, onReelLanded: (reel) => landed.push(reel) })

    advanceUntilIdle(machine)
    await falling

    expect(untouched?.getRevision()).toBe(revision)
    expect(landed.sort()).toEqual([...new Set(REMOVED.map((cell) => cell.reel))].sort())
    expect(landed).not.toContain(1)
    expect(landed.length).toBeLessThan(REELS)
  })

  it('реджектит каскад по отмене и возвращает барабаны в покой', async () => {
    const machine = await createLandedMachine()
    const controller = new AbortController()

    machine.setData(applyCascade(createGrid(), REMOVED))

    const falling = machine.cascade({ removed: REMOVED, signal: controller.signal })

    machine.advance(3)
    controller.abort(new DOMException('aborted', 'AbortError'))

    await expect(falling).rejects.toThrow('aborted')
    expect(machine.getPhase()).toBe(ReelPhase.idle)
  })
})
