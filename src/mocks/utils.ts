import type { SpinResponse } from 'src/api/root-api'
import { SymbolKey } from 'src/types/game'

import {
  LINES_PER_MODE,
  PAY_TABLE,
  PAYLINES,
  REELS,
  ROWS,
  WIN_PROBABILITY,
  WINNING_SYMBOLS,
} from './constants'
import type { SpinRequestPayload, SpinTransformation } from './types'

const ALL_SYMBOLS = Object.values(SymbolKey)

const randomItem = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]

/** Доступные длины выигрыша для символа: числовые ключи PAY_TABLE в пределах числа барабанов. */
const countsFor = (symbol: SymbolKey): number[] =>
  Object.keys(PAY_TABLE[symbol])
    .map(Number)
    .filter((count) => Number.isInteger(count) && count >= 2 && count <= REELS)

/** Округляет сумму до копеек (currencyMinimalUnit = 0.01). */
export const roundMoney = (value: number): number => Math.round(value * 100) / 100

/** Случайный hex-хэш из 32 байт в верхнем регистре — форма securityHash сервера. */
export const randomHash = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()

/** Безопасно читает payload запроса спина, подставляя дефолты вместо отсутствующих полей. */
export const parseSpinPayload = (payload: unknown): SpinRequestPayload => {
  const data = (payload ?? {}) as Partial<SpinRequestPayload>

  return {
    bet: typeof data.bet === 'number' ? data.bet : 0,
    gameMode: typeof data.gameMode === 'number' ? data.gameMode : 0,
  }
}

/** Создаёт сетку 5×3 (барабаны × ряды) из случайных символов SymbolKey. */
const createGrid = (): SymbolKey[][] =>
  Array.from({ length: REELS }, () => Array.from({ length: ROWS }, () => randomItem(ALL_SYMBOLS)))

/**
 * Разыгрывает исход спина: собирает сетку и с вероятностью 50% выкладывает выигрышную линию
 * среди активных (число линий задаёт gameMode). Возвращает трансформации ответа и сумму выигрыша.
 */
export const generateSpinOutcome = (
  bet: number,
  gameMode: number
): { transformations: SpinTransformation[]; win: number } => {
  const grid = createGrid()
  const activeLineCount = LINES_PER_MODE[gameMode] ?? LINES_PER_MODE[0]
  const transformations: SpinTransformation[] = [{ type: 'frameInit', value: grid }]

  if (Math.random() >= WIN_PROBABILITY) {
    transformations.push({ type: 'win', value: 0 })

    return { transformations, win: 0 }
  }

  const lineId = String(Math.floor(Math.random() * activeLineCount))
  const line = PAYLINES[lineId]
  const symbol = randomItem(WINNING_SYMBOLS)
  const count = randomItem(countsFor(symbol))

  for (let reel = 0; reel < count; reel += 1) {
    grid[reel][line[reel]] = symbol
  }

  // Обрываем линию на следующем барабане, чтобы её длина совпала с count.
  if (count < REELS) {
    grid[count][line[count]] = randomItem(ALL_SYMBOLS.filter((candidate) => candidate !== symbol))
  }

  const win = roundMoney(PAY_TABLE[symbol][String(count)] * bet)
  const linePositions = line.map((row, reel) => (reel < count ? row : null))

  transformations.push(
    { type: 'paylines', value: [{ lineId, line: linePositions, value: win }] },
    { type: 'win', value: win }
  )

  return { transformations, win }
}

/** Собирает result спина из посчитанных полей раунда; обёртку { request, response } добавит транспорт мока. */
export const buildSpinResponse = ({
  bet,
  balance,
  totalWin,
  transformations,
}: {
  bet: number
  balance: number
  totalWin: number
  transformations: SpinTransformation[]
}): SpinResponse['response']['result'] => ({
  roundId: crypto.randomUUID(),
  bet,
  balance,
  totalWin,
  platformMaxWin: null,
  endedUtc: new Date().toISOString(),
  SpinResponse: { transformations },
  freeRoundCampaign: null,
})
