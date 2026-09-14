import { GravityFallStrategy } from 'src/core/reels/strategies/gravity-fall'
import { LinearSpinStrategy } from 'src/core/reels/strategies/linear-spin'
import { PlannedLandingStrategy } from 'src/core/reels/strategies/planned-landing'
import type { ReelsConfig, ReelStrategies } from 'src/core/reels/types'
import { CELL_HEIGHT, HOLD_WIN_CELLS_COUNT, REELS_COUNT, VISIBLE_SYMBOLS_COUNT } from 'src/games/slot/constants'
import type { CoinValue, HoldWinCell, SymbolKey } from 'src/games/slot/types'
import { getRandomSymbolKey, toHoldWinCell } from 'src/games/slot/utils'

// Скорости — единиц за кадр, ускорения — единиц за кадр² (deltaFrames = 1 при 60 fps);
// длины — в пикселях зоны символов
const SPIN_SPEED = 60
const LANDING_DECELERATION = 2
const LANDING_HANDOVER_SPEED = 30
const LANDING_EASE_CELLS = 0.25
const LANDING_BACK_STRENGTH = 0.35
const LAND_STAGGER_CELLS = 2
const MIN_SPIN_FRAMES = 30
// Пауза anticipation на каждый ждущий барабан: около 1.4 с на SPIN_SPEED
const ANTICIPATION_CELLS = 24
const BUFFER_SYMBOLS_COUNT = 1

// Турбо ускоряет вращение барабанов и падение и сокращает stagger
const TURBO_SPEED_FACTOR = 1.5
const TURBO_STAGGER_CELLS = 0.5

// Ячеек бонуса втрое больше, чем барабанов: stagger короче, чтобы посадка шага не растягивалась
const HOLD_WIN_STAGGER_CELLS = 0.5
const HOLD_WIN_TURBO_STAGGER_CELLS = 0.15

// Падение каскада: одна ячейка за ~13 кадров, барабаны и ряды стартуют со stagger
const FALL_GRAVITY = 2.5
const FALL_STAGGER_FRAMES = 3
const FALL_ROW_STAGGER_FRAMES = 2
const FALL_BOUNCE_CELLS = 0.06
const FALL_BOUNCE_FRAMES = 8

/**
 * Набор стратегий на скорости `SPIN_SPEED * speedFactor`: у прокрутки и равномерного участка посадки одна
 * скорость, иначе на входе в посадку она скачет. Ускорения растут квадратом множителя, интервалы падения делятся на него.
 */
const createStrategies = (options: {
  speedFactor: number
  staggerCells: number
  minSpinFrames?: number
  anticipationCells?: number
  hasFall?: boolean
}): ReelStrategies => {
  const { speedFactor, staggerCells, minSpinFrames, anticipationCells, hasFall = false } = options
  const speed = SPIN_SPEED * speedFactor

  return {
    spinStrategy: new LinearSpinStrategy({ speed }),
    landingStrategy: new PlannedLandingStrategy({
      speed,
      deceleration: LANDING_DECELERATION * speedFactor ** 2,
      handoverSpeed: LANDING_HANDOVER_SPEED,
      easeCells: LANDING_EASE_CELLS,
      backStrength: LANDING_BACK_STRENGTH,
      staggerCells,
      minSpinFrames,
      anticipationCells,
    }),
    fallStrategy: hasFall
      ? new GravityFallStrategy({
          gravity: FALL_GRAVITY * speedFactor ** 2,
          staggerFrames: FALL_STAGGER_FRAMES / speedFactor,
          rowStaggerFrames: FALL_ROW_STAGGER_FRAMES / speedFactor,
          bounceCells: FALL_BOUNCE_CELLS,
          bounceFrames: FALL_BOUNCE_FRAMES / speedFactor,
        })
      : undefined,
  }
}

/** Данные раунда для барабанов: сетка символов `[барабан][ряд]`. */
export type SlotReelsData = SymbolKey[][]

/** Обычное движение: минимум вращения, полный stagger остановки, паузы anticipation и падение каскада. */
export const SLOT_STRATEGIES = createStrategies({
  speedFactor: 1,
  staggerCells: LAND_STAGGER_CELLS,
  minSpinFrames: MIN_SPIN_FRAMES,
  anticipationCells: ANTICIPATION_CELLS,
  hasFall: true,
})

/** Турбо: вращение и падение быстрее, stagger короче, без минимума вращения и пауз anticipation. */
export const SLOT_TURBO_STRATEGIES = createStrategies({
  speedFactor: TURBO_SPEED_FACTOR,
  staggerCells: TURBO_STAGGER_CELLS,
  hasFall: true,
})

/** Состав барабанов слота: пять одинаковых барабанов, значение ячейки — символ сетки раунда. */
export const SLOT_REELS: ReelsConfig<SlotReelsData, SymbolKey> = {
  reels: Array.from({ length: REELS_COUNT }, (_, index) => ({ id: `reel-${index}` })),
  rows: VISIBLE_SYMBOLS_COUNT,
  buffer: BUFFER_SYMBOLS_COUNT,
  cellHeight: CELL_HEIGHT,
  accessorFn: (data, { reel, row }) => data[reel]?.[row],
  getFillerValue: () => getRandomSymbolKey(),
  ...SLOT_STRATEGIES,
}

/** Данные раунда для ячеек Hold & Win: поле `[барабан][ряд]` с номиналами монет. */
export type HoldWinReelsData = CoinValue[][]

/** Движение ячеек бонуса: как у барабанов, с коротким stagger. */
export const HOLD_WIN_STRATEGIES = createStrategies({
  speedFactor: 1,
  staggerCells: HOLD_WIN_STAGGER_CELLS,
  minSpinFrames: MIN_SPIN_FRAMES,
})

/** Турбо ячеек бонуса: вращение быстрее, stagger минимальный. */
export const HOLD_WIN_TURBO_STRATEGIES = createStrategies({
  speedFactor: TURBO_SPEED_FACTOR,
  staggerCells: HOLD_WIN_TURBO_STAGGER_CELLS,
})

/**
 * Состав ячеек Hold & Win: по барабану высотой 1 на каждую ячейку сетки 5×3, нумерация по колонкам.
 * Значение ячейки — номинал монеты из поля шага; наполнение — случайные символы игры, как у барабанов.
 */
export const HOLD_WIN_REELS: ReelsConfig<HoldWinReelsData, HoldWinCell> = {
  reels: Array.from({ length: HOLD_WIN_CELLS_COUNT }, (_, index) => ({ id: `cell-${index}` })),
  rows: 1,
  buffer: BUFFER_SYMBOLS_COUNT,
  cellHeight: CELL_HEIGHT,
  accessorFn: (data, { reel }) => {
    const cell = toHoldWinCell(reel)

    return data[cell.reel]?.[cell.row]
  },
  getFillerValue: () => getRandomSymbolKey(),
  ...HOLD_WIN_STRATEGIES,
}
