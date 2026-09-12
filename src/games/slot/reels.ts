import { GravityFallStrategy } from 'src/core/reels/strategies/gravity-fall'
import { LinearSpinStrategy } from 'src/core/reels/strategies/linear-spin'
import { PlannedLandingStrategy } from 'src/core/reels/strategies/planned-landing'
import type { GravityFallOptions, PlannedLandingOptions } from 'src/core/reels/strategies/types'
import type { ReelsConfig, ReelStrategies } from 'src/core/reels/types'
import { CELL_HEIGHT, HOLD_WIN_CELLS_COUNT, REELS_COUNT, VISIBLE_SYMBOLS_COUNT } from 'src/games/slot/constants'
import type { CoinValue, HoldWinCell, SymbolKey } from 'src/games/slot/types'
import { getRandomSymbolKey, toHoldWinCell } from 'src/games/slot/utils'

// Скорости и ускорение — на кадр приведённой частоты (deltaFrames = 1 при 60 fps),
// длины — в нативных пикселях зоны символов: в них же машина отдаёт позиции слотов
const SPIN_SPEED = 60
const LANDING_DECELERATION = 2
const LANDING_HANDOVER_SPEED = 30
const LANDING_EASE_CELLS = 0.25
const LANDING_BACK_STRENGTH = 0.35
const LAND_STAGGER_CELLS = 2
const MIN_SPIN_FRAMES = 30
// Пауза anticipation на каждый ждущий барабан: около 1.4 с круиза на SPIN_SPEED
const ANTICIPATION_CELLS = 24
const BUFFER_SYMBOLS_COUNT = 1

// Турбо ускоряет ленту и сжимает лесенку; торможение растёт квадратом, чтобы тормозной путь рос как у скорости
const TURBO_SPEED_FACTOR = 1.5
const TURBO_STAGGER_CELLS = 0.5

// Ячеек бонуса втрое больше, чем барабанов: лесенка короче, чтобы посадка шага не растягивалась
const HOLD_WIN_STAGGER_CELLS = 0.5
const HOLD_WIN_TURBO_STAGGER_CELLS = 0.15

// Падение каскада: ячейку символ пролетает за ~13 кадров, барабаны и ряды стартуют лесенкой
const FALL_GRAVITY = 2.5
const FALL_STAGGER_FRAMES = 3
const FALL_ROW_STAGGER_FRAMES = 2
const FALL_BOUNCE_CELLS = 0.06
const FALL_BOUNCE_FRAMES = 8

const LANDING_OPTIONS: PlannedLandingOptions = {
  speed: SPIN_SPEED,
  deceleration: LANDING_DECELERATION,
  handoverSpeed: LANDING_HANDOVER_SPEED,
  easeCells: LANDING_EASE_CELLS,
  backStrength: LANDING_BACK_STRENGTH,
  staggerCells: LAND_STAGGER_CELLS,
}

const FALL_OPTIONS: GravityFallOptions = {
  gravity: FALL_GRAVITY,
  staggerFrames: FALL_STAGGER_FRAMES,
  rowStaggerFrames: FALL_ROW_STAGGER_FRAMES,
  bounceCells: FALL_BOUNCE_CELLS,
  bounceFrames: FALL_BOUNCE_FRAMES,
}

/** Данные раунда для лент: сетка символов `[барабан][ряд]`. */
export type SlotReelsData = SymbolKey[][]

/** Обычное движение: минимум вращения, полная лесенка остановки, паузы anticipation и падение каскада. */
export const SLOT_STRATEGIES: ReelStrategies = {
  spinStrategy: new LinearSpinStrategy({ speed: SPIN_SPEED }),
  landingStrategy: new PlannedLandingStrategy({
    ...LANDING_OPTIONS,
    minSpinFrames: MIN_SPIN_FRAMES,
    anticipationCells: ANTICIPATION_CELLS,
  }),
  fallStrategy: new GravityFallStrategy(FALL_OPTIONS),
}

/**
 * Турбо: лента быстрее, лесенка сжата, барабан садится сразу по приходу результата, пауз anticipation нет.
 * Падение быстрее тем же множителем: ускорение растёт квадратом, лесенка делится на множитель.
 */
export const SLOT_TURBO_STRATEGIES: ReelStrategies = {
  spinStrategy: new LinearSpinStrategy({ speed: SPIN_SPEED * TURBO_SPEED_FACTOR }),
  landingStrategy: new PlannedLandingStrategy({
    ...LANDING_OPTIONS,
    speed: SPIN_SPEED * TURBO_SPEED_FACTOR,
    deceleration: LANDING_DECELERATION * TURBO_SPEED_FACTOR ** 2,
    staggerCells: TURBO_STAGGER_CELLS,
  }),
  fallStrategy: new GravityFallStrategy({
    ...FALL_OPTIONS,
    gravity: FALL_GRAVITY * TURBO_SPEED_FACTOR ** 2,
    staggerFrames: FALL_STAGGER_FRAMES / TURBO_SPEED_FACTOR,
    rowStaggerFrames: FALL_ROW_STAGGER_FRAMES / TURBO_SPEED_FACTOR,
    bounceFrames: FALL_BOUNCE_FRAMES / TURBO_SPEED_FACTOR,
  }),
}

/** Состав барабанов слота: пять одинаковых лент, значение ячейки — символ сетки раунда. */
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

/** Движение ячеек бонуса: как у барабанов, с короткой лесенкой. */
export const HOLD_WIN_STRATEGIES: ReelStrategies = {
  spinStrategy: new LinearSpinStrategy({ speed: SPIN_SPEED }),
  landingStrategy: new PlannedLandingStrategy({
    ...LANDING_OPTIONS,
    minSpinFrames: MIN_SPIN_FRAMES,
    staggerCells: HOLD_WIN_STAGGER_CELLS,
  }),
}

/** Турбо ячеек бонуса: лента быстрее, лесенка почти схлопнута. */
export const HOLD_WIN_TURBO_STRATEGIES: ReelStrategies = {
  spinStrategy: new LinearSpinStrategy({ speed: SPIN_SPEED * TURBO_SPEED_FACTOR }),
  landingStrategy: new PlannedLandingStrategy({
    ...LANDING_OPTIONS,
    speed: SPIN_SPEED * TURBO_SPEED_FACTOR,
    deceleration: LANDING_DECELERATION * TURBO_SPEED_FACTOR ** 2,
    staggerCells: HOLD_WIN_TURBO_STAGGER_CELLS,
  }),
}

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
