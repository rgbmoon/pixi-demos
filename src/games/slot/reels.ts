import { LinearSpinStrategy } from 'src/core/reels/strategies/linear-spin'
import { PlannedLandingStrategy } from 'src/core/reels/strategies/planned-landing'
import type { ReelsConfig } from 'src/core/reels/types'
import { CELL_HEIGHT, REELS_COUNT, VISIBLE_SYMBOLS_COUNT } from 'src/games/slot/constants'
import type { SymbolKey } from 'src/games/slot/types'
import { getRandomSymbolKey } from 'src/games/slot/utils'

// Скорости и ускорение — на кадр приведённой частоты (deltaFrames = 1 при 60 fps),
// длины — в нативных пикселях зоны символов: в них же машина отдаёт позиции слотов
const SPIN_SPEED = 60
const LANDING_DECELERATION = 2
const LANDING_HANDOVER_SPEED = 30
const LANDING_EASE_CELLS = 0.25
const LANDING_BACK_STRENGTH = 0.35
const LAND_STAGGER_CELLS = 2
const BUFFER_SYMBOLS_COUNT = 1

/** Данные раунда для лент: сетка символов `[барабан][ряд]`. */
export type SlotReelsData = SymbolKey[][]

/** Состав барабанов слота: пять одинаковых лент, значение ячейки — символ сетки раунда. */
export const SLOT_REELS: ReelsConfig<SlotReelsData, SymbolKey> = {
  reels: Array.from({ length: REELS_COUNT }, (_, index) => ({ id: `reel-${index}` })),
  rows: VISIBLE_SYMBOLS_COUNT,
  buffer: BUFFER_SYMBOLS_COUNT,
  cellHeight: CELL_HEIGHT,
  accessorFn: (data, { reel, row }) => data[reel]?.[row],
  getFillerValue: getRandomSymbolKey,
  spinStrategy: new LinearSpinStrategy({ speed: SPIN_SPEED }),
  landingStrategy: new PlannedLandingStrategy({
    speed: SPIN_SPEED,
    deceleration: LANDING_DECELERATION,
    handoverSpeed: LANDING_HANDOVER_SPEED,
    easeCells: LANDING_EASE_CELLS,
    backStrength: LANDING_BACK_STRENGTH,
    staggerCells: LAND_STAGGER_CELLS,
  }),
}
