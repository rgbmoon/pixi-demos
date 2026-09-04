import type { Payline, SpinResult } from 'src/games/slot/api/slot'
import { SymbolKey } from 'src/games/slot/types'

import { LINES_PER_MODE, PAY_TABLE, PAYLINES, REELS, ROWS, WIN_PROBABILITY, WINNING_SYMBOLS } from './constants'
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
    gameMode: typeof data.gameMode === 'string' ? data.gameMode : '0',
  }
}

/** Создаёт сетку 5×3 (барабаны × ряды) из случайных символов SymbolKey. */
const createGrid = (): SymbolKey[][] =>
  Array.from({ length: REELS }, () => Array.from({ length: ROWS }, () => randomItem(ALL_SYMBOLS)))

/** Активные линии режима: первые LINES_PER_MODE[gameMode] ключей конфига PAYLINES. */
const activeLines = (gameMode: string): string[] =>
  Object.keys(PAYLINES).slice(0, LINES_PER_MODE[Number(gameMode)] ?? LINES_PER_MODE[0])

/** Выкладывает на линию серию одинаковых символов случайной оплачиваемой длины. */
const plantWin = (grid: SymbolKey[][], line: number[]) => {
  const symbol = randomItem(WINNING_SYMBOLS)
  const count = randomItem(countsFor(symbol))

  for (let reel = 0; reel < count; reel += 1) {
    grid[reel][line[reel]] = symbol
  }

  // Обрываем линию на следующем барабане, чтобы её длина совпала с count.
  if (count < REELS) {
    grid[count][line[count]] = randomItem(ALL_SYMBOLS.filter((candidate) => candidate !== symbol))
  }
}

/**
 * Ищет выигрыши по готовой сетке: у каждой активной линии берёт серию одинаковых символов
 * с первого барабана и оставляет линию, если такая длина есть в таблице выплат.
 */
const detectPaylines = (grid: SymbolKey[][], lineIds: string[], bet: number): Payline[] =>
  lineIds.flatMap((lineId) => {
    const line = PAYLINES[lineId]
    const symbol = grid[0][line[0]]

    let count = 1
    while (count < REELS && grid[count][line[count]] === symbol) {
      count += 1
    }

    // Символ без выплат (E, F), скаттер со составными ключами (S) и серия короче минимума дают undefined.
    const payout = PAY_TABLE[symbol]?.[String(count)]

    if (payout === undefined) {
      return []
    }

    return [
      {
        lineId,
        line: line.map((row, reel) => (reel < count ? row : null)),
        value: roundMoney(payout * bet),
      },
    ]
  })

/**
 * Разыгрывает исход спина: собирает сетку, с вероятностью WIN_PROBABILITY подсаживает серию
 * на случайную активную линию и детектит выигрыши по всем активным линиям. Сумма — по найденным линиям.
 */
export const generateSpinOutcome = (
  bet: number,
  gameMode: string
): { transformations: SpinTransformation[]; win: number } => {
  const grid = createGrid()
  const lineIds = activeLines(gameMode)

  if (Math.random() < WIN_PROBABILITY) {
    plantWin(grid, PAYLINES[randomItem(lineIds)])
  }

  // Детект — единственный источник правды: подсаженная линия может задеть соседние, они тоже выиграют.
  const paylines = detectPaylines(grid, lineIds, bet)
  const win = roundMoney(paylines.reduce((sum, payline) => sum + payline.value, 0))
  const transformations: SpinTransformation[] = [{ type: 'frameInit', value: grid }]

  if (paylines.length > 0) {
    transformations.push({ type: 'paylines', value: paylines })
  }

  transformations.push({ type: 'win', value: win })

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
}): SpinResult => ({
  roundId: crypto.randomUUID(),
  bet,
  balance,
  totalWin,
  platformMaxWin: null,
  endedUtc: new Date().toISOString(),
  SpinResponse: { transformations },
  freeRoundCampaign: null,
})
