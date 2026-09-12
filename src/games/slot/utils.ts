import type { PointData } from 'pixi.js'
import { pickRandom } from 'src/core/random'
import type { CellIndex } from 'src/core/reels/types'
import type { Random } from 'src/core/types'
import { SymbolKey } from 'src/games/slot/types'

import { CELL_HEIGHT, CELL_WIDTH, PAYLINES, VISIBLE_SYMBOLS_COUNT } from './constants'
import type { PaylineShape } from './types'

/** Индекс ленты Hold & Win по адресу ячейки сетки: ленты пронумерованы по колонкам, сверху вниз. */
export const toHoldWinReel = ({ reel, row }: CellIndex): number => reel * VISIBLE_SYMBOLS_COUNT + row

/** Адрес ячейки сетки по индексу ленты Hold & Win. */
export const toHoldWinCell = (index: number): CellIndex => ({
  reel: Math.floor(index / VISIBLE_SYMBOLS_COUNT),
  row: index % VISIBLE_SYMBOLS_COUNT,
})

/** Центр ленты Hold & Win в координатах зоны символов: там же, где ячейка базовой доски. */
export const getHoldWinReelPosition = (index: number): PointData => {
  const { reel, row } = toHoldWinCell(index)

  return { x: CELL_WIDTH * reel, y: CELL_HEIGHT * row }
}

/** Возвращает линии, участвующие в раунде: первые `lines` ключей конфига. */
export const getActiveLineIds = (lines: number): string[] => Object.keys(PAYLINES).slice(0, lines)

/** Возвращает точки ломаной линии выплат в координатах зоны символов: от левой границы рамки через центры ячеек к правой. */
export const getPaylinePoints = ({ rows, offsetCells }: PaylineShape): PointData[] => {
  const offsetY = offsetCells * CELL_HEIGHT
  const cells = rows.map((row, reel) => ({ x: CELL_WIDTH * reel, y: CELL_HEIGHT * row + offsetY }))
  const first = cells[0]
  const last = cells[cells.length - 1]

  return [{ x: first.x - CELL_WIDTH / 2, y: first.y }, ...cells, { x: last.x + CELL_WIDTH / 2, y: last.y }]
}

const SYMBOL_KEYS = Object.values<SymbolKey>(SymbolKey)

export const getRandomSymbolKey = (random: Random = Math.random): SymbolKey => pickRandom(SYMBOL_KEYS, random)

// Скаттер в пустой ячейке бонуса читался бы как монета без номинала
const EMPTY_CELL_SYMBOL_KEYS = SYMBOL_KEYS.filter((key) => key !== SymbolKey.S)

/** Случайный символ для пустой ячейки бонуса: любой, кроме скаттера. */
export const getRandomEmptyCellSymbolKey = (random: Random = Math.random): SymbolKey =>
  pickRandom(EMPTY_CELL_SYMBOL_KEYS, random)

/** Форматирует денежную сумму для HUD: разряды через запятую, два знака после точки. */
export const formatAmount = (value: number): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
