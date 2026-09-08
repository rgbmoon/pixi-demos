import { createRandom, pickRandom } from 'src/core/random'
import type { Random } from 'src/core/types'
import type { Payline, SpinResult } from 'src/games/slot/api/slot'
import { SymbolKey } from 'src/games/slot/types'

import { LINES_PER_MODE, PAY_TABLE, PAYLINES, REELS, ROWS, WIN_PROBABILITY, WINNING_SYMBOLS } from './constants'
import { MockScenario, type MockOptions, type SpinRequestPayload, type SpinTransformation } from './types'

const ALL_SYMBOLS = Object.values(SymbolKey)

/** Доступные длины выигрыша для символа: числовые ключи PAY_TABLE в пределах числа барабанов. */
const countsFor = (symbol: SymbolKey): number[] =>
  Object.keys(PAY_TABLE[symbol] ?? {})
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
const createGrid = (random: Random): SymbolKey[][] =>
  Array.from({ length: REELS }, () => Array.from({ length: ROWS }, () => pickRandom(ALL_SYMBOLS, random)))

/** Активные линии режима: первые LINES_PER_MODE[gameMode] ключей конфига PAYLINES. */
const activeLines = (gameMode: string): string[] =>
  Object.keys(PAYLINES).slice(0, LINES_PER_MODE[Number(gameMode)] ?? LINES_PER_MODE[0])

/** Выкладывает на линию серию одинаковых символов: длина случайна, если не задана явно. */
const plantWin = (grid: SymbolKey[][], line: number[], random: Random, forced?: { symbol: SymbolKey; count: number }) => {
  const symbol = forced?.symbol ?? pickRandom(WINNING_SYMBOLS, random)
  const count = forced?.count ?? pickRandom(countsFor(symbol), random)

  for (let reel = 0; reel < count; reel += 1) {
    grid[reel][line[reel]] = symbol
  }

  // Обрываем линию на следующем барабане, чтобы её длина совпала с count.
  if (count < REELS) {
    grid[count][line[count]] = pickRandom(
      ALL_SYMBOLS.filter((candidate) => candidate !== symbol),
      random
    )
  }
}

/** Рвёт все активные линии на втором барабане: гарантированный ноль без перебора сеток. */
const breakLines = (grid: SymbolKey[][], lineIds: string[], random: Random) => {
  lineIds.forEach((lineId) => {
    const line = PAYLINES[lineId]
    const symbol = grid[0][line[0]]

    grid[1][line[1]] = pickRandom(
      ALL_SYMBOLS.filter((candidate) => candidate !== symbol),
      random
    )
  })
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
 * Разыгрывает исход спина: собирает сетку, подсаживает серию по сценарию (или с вероятностью
 * WIN_PROBABILITY) и детектит выигрыши по всем активным линиям. Сумма — по найденным линиям.
 */
export const generateSpinOutcome = (
  bet: number,
  gameMode: string,
  { random, scenario }: MockOptions
): { transformations: SpinTransformation[]; win: number } => {
  const grid = createGrid(random)
  const lineIds = activeLines(gameMode)

  if (scenario === MockScenario.bigwin) {
    plantWin(grid, PAYLINES[lineIds[0]], random, { symbol: SymbolKey.A, count: REELS })
  } else if (scenario === MockScenario.nowin) {
    breakLines(grid, lineIds, random)
  } else if (random() < WIN_PROBABILITY) {
    plantWin(grid, PAYLINES[pickRandom(lineIds, random)], random)
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

const isMockScenario = (value: string | null): value is MockScenario =>
  value !== null && Object.values<string>(MockScenario).includes(value)

/**
 * Читает настройки мока из строки запроса: `?scenario=bigwin&seed=1`.
 * Без параметров мок остаётся случайным — обычный dev-режим не должен становиться детерминированным.
 */
export const parseMockOptions = (search: string): MockOptions => {
  const params = new URLSearchParams(search)
  const seed = Number(params.get('seed'))
  const scenario = params.get('scenario')

  return {
    random: params.has('seed') && Number.isFinite(seed) ? createRandom(seed) : Math.random,
    scenario: isMockScenario(scenario) ? scenario : MockScenario.random,
  }
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
