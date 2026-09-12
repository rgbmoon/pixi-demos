import { ReelsMachine } from 'src/core/reels/reels-machine'
import { GravityFallStrategy } from 'src/core/reels/strategies/gravity-fall'
import { LinearSpinStrategy } from 'src/core/reels/strategies/linear-spin'
import { PlannedLandingStrategy } from 'src/core/reels/strategies/planned-landing'
import type { GravityFallOptions, PlannedLandingOptions } from 'src/core/reels/strategies/types'
import { ReelPhase, type ReelsConfig } from 'src/core/reels/types'

/** Сетка раунда: значение ячейки `[барабан][ряд]`. */
export type TestData = string[][]

export const REELS = 5
export const ROWS = 3
export const BUFFER = 1
/** Боевая высота ячейки слота: нецелая, на ней и вылезают ошибки округления. */
export const CELL_HEIGHT = 610 / 3
export const STRIP_HEIGHT = (ROWS + BUFFER) * CELL_HEIGHT
export const FILLER = 'filler'

const SPIN_SPEED = 60

/** Страховка от бесконечного цикла, если посадка не завершится. */
const MAX_FRAMES = 100_000

/** Боевые настройки посадки слота. */
export const LANDING_OPTIONS: PlannedLandingOptions = {
  speed: SPIN_SPEED,
  deceleration: 2,
  handoverSpeed: 30,
  easeCells: 0.25,
  backStrength: 0.35,
  staggerCells: 2,
}

/** Боевые настройки падения каскада слота. */
export const FALL_OPTIONS: GravityFallOptions = {
  gravity: 2.5,
  staggerFrames: 3,
  rowStaggerFrames: 2,
  bounceCells: 0.06,
  bounceFrames: 8,
}

export const createConfig = (): ReelsConfig<TestData, string> => ({
  reels: Array.from({ length: REELS }, (_, index) => ({ id: `reel-${index}` })),
  rows: ROWS,
  buffer: BUFFER,
  cellHeight: CELL_HEIGHT,
  accessorFn: (data, { reel, row }) => data[reel]?.[row],
  getFillerValue: () => FILLER,
  spinStrategy: new LinearSpinStrategy({ speed: SPIN_SPEED }),
  landingStrategy: new PlannedLandingStrategy(LANDING_OPTIONS),
  fallStrategy: new GravityFallStrategy(FALL_OPTIONS),
})

export const createMachine = (): ReelsMachine<TestData, string> => new ReelsMachine(createConfig())

/** Сетка вида `r<барабан>c<ряд>`: значение ячейки однозначно называет свой адрес. */
export const createGrid = (): TestData =>
  Array.from({ length: REELS }, (_, reel) => Array.from({ length: ROWS }, (_, row) => `r${reel}c${row}`))

/** Крутит модель до полной остановки; шаг задаётся вызывающим. */
export const advanceUntilIdle = <TData, TValue>(machine: ReelsMachine<TData, TValue>, deltaFrames = 1): number => {
  let frames = 0

  while (machine.getPhase() !== ReelPhase.idle) {
    machine.advance(deltaFrames)
    frames += 1

    if (frames > MAX_FRAMES) throw new Error('advanceUntilIdle: посадка не завершилась')
  }

  return frames
}

/** Значения видимых ячеек машины: сетка `[барабан][ряд]` того, что стоит на экране. */
export const readVisibleGrid = (machine: ReelsMachine<TestData, string>): (string | undefined)[][] =>
  machine.getReels().map((reel) => reel.getCells().map((cell) => cell.getSlot()?.value))
