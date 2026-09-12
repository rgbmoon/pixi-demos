import { createRandom, pickRandom } from 'src/core/random'
import type { Random } from 'src/core/types'
import type { Payline, RespinStep, SpinResult } from 'src/games/slot/api/slot'
import { SymbolKey } from 'src/games/slot/types'

import {
  ANTICIPATION_HIT_PROBABILITY,
  ANTICIPATION_SCATTERS,
  LINES_PER_MODE,
  MAX_RESPINS,
  PAY_TABLE,
  PAYLINES,
  REELS,
  RESPIN_PROBABILITY,
  RESPIN_WILD_PROBABILITY,
  ROWS,
  WIN_PROBABILITY,
  WINNING_SYMBOLS,
} from './constants'
import { MockScenario, type MockOptions, type SpinRequestPayload, type SpinTransformation } from './types'

// Вайлд в сетку попадает только подсадкой: каждый W запускает респин, случайный W был бы почти в каждом раунде
const BASE_SYMBOLS = Object.values(SymbolKey).filter((symbol) => symbol !== SymbolKey.W)

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
    forceAnticipation: data.forceAnticipation === true,
    forceRespin: data.forceRespin === true,
  }
}

/** Создаёт колонку барабана из случайных символов без вайлда. */
const createColumn = (random: Random): SymbolKey[] =>
  Array.from({ length: ROWS }, () => pickRandom(BASE_SYMBOLS, random))

/** Создаёт сетку 5×3 (барабаны × ряды) из случайных символов без вайлда. */
const createGrid = (random: Random): SymbolKey[][] => Array.from({ length: REELS }, () => createColumn(random))

/** Активные линии режима: первые LINES_PER_MODE[gameMode] ключей конфига PAYLINES. */
const activeLines = (gameMode: string): string[] =>
  Object.keys(PAYLINES).slice(0, LINES_PER_MODE[Number(gameMode)] ?? LINES_PER_MODE[0])

/**
 * Выкладывает на линию серию одинаковых символов: длина случайна, если не задана явно.
 * Возвращает ряды линии, чтобы следующая подсадка их обошла.
 */
const plantWin = (
  grid: SymbolKey[][],
  line: number[],
  random: Random,
  forced?: { symbol: SymbolKey; count: number }
): number[] => {
  const symbol = forced?.symbol ?? pickRandom(WINNING_SYMBOLS, random)
  const count = forced?.count ?? pickRandom(countsFor(symbol), random)

  for (let reel = 0; reel < count; reel += 1) {
    grid[reel][line[reel]] = symbol
  }

  // Обрываем линию на следующем барабане, чтобы её длина совпала с count.
  if (count < REELS) {
    grid[count][line[count]] = pickRandom(
      BASE_SYMBOLS.filter((candidate) => candidate !== symbol),
      random
    )
  }

  return line
}

/** Рвёт все активные линии на втором барабане: гарантированный ноль без перебора сеток. */
const breakLines = (grid: SymbolKey[][], lineIds: string[], random: Random) => {
  lineIds.forEach((lineId) => {
    const line = PAYLINES[lineId]
    const symbol = grid[0][line[0]]

    grid[1][line[1]] = pickRandom(
      BASE_SYMBOLS.filter((candidate) => candidate !== symbol),
      random
    )
  })
}

/** Кладёт символ на случайный ряд барабана, минуя ряд `avoidRow` и, если есть выбор, уже лежащий скаттер. */
const plantSymbol = (grid: SymbolKey[][], reel: number, symbol: SymbolKey, random: Random, avoidRow?: number) => {
  const rows = Array.from({ length: ROWS }, (_, row) => row).filter((row) => row !== avoidRow)
  const free = rows.filter((row) => grid[reel][row] !== SymbolKey.S)

  grid[reel][pickRandom(free.length > 0 ? free : rows, random)] = symbol
}

/**
 * Скаттеры на двух первых барабанах, третий — с вероятностью ANTICIPATION_HIT_PROBABILITY на одном
 * из оставшихся: раунд с гарантированным anticipation и случайной развязкой. Ряды подсаженной
 * линии `line` скаттеры обходят, иначе оборвали бы её выигрыш.
 */
const plantAnticipation = (grid: SymbolKey[][], random: Random, line?: number[]) => {
  plantSymbol(grid, 0, SymbolKey.S, random, line?.[0])
  plantSymbol(grid, 1, SymbolKey.S, random, line?.[1])

  if (random() < ANTICIPATION_HIT_PROBABILITY) {
    const reel = 2 + Math.floor(random() * (REELS - 2))

    plantSymbol(grid, reel, SymbolKey.S, random, line?.[reel])
  }
}

/**
 * Барабаны с паузой anticipation: как только на барабанах слева набралось ANTICIPATION_SCATTERS
 * скаттеров, в неё уходят все барабаны правее.
 */
export const detectAnticipation = (grid: SymbolKey[][]): number[] => {
  let scatters = 0

  for (let reel = 0; reel < grid.length; reel += 1) {
    scatters += grid[reel].filter((symbol) => symbol === SymbolKey.S).length

    if (scatters >= ANTICIPATION_SCATTERS) {
      return Array.from({ length: grid.length - reel - 1 }, (_, offset) => reel + 1 + offset)
    }
  }

  return []
}

/** Длина серии с первого барабана из символов, подходящих под `matches`. */
const countRun = (symbols: SymbolKey[], matches: (symbol: SymbolKey) => boolean): number => {
  const index = symbols.findIndex((symbol) => !matches(symbol))

  return index === -1 ? symbols.length : index
}

/**
 * Выплата линии с заменой: символ линии — первый не-вайлд, вайлды продлевают его серию; серия из
 * одних вайлдов платит по строке W. Из двух вариантов берётся больший. Символ без выплат (E, F),
 * скаттер со составными ключами (S) и серия короче минимума выплаты не дают.
 */
const evaluateLine = (symbols: SymbolKey[]): { count: number; payout: number } | undefined => {
  const isWild = (symbol: SymbolKey) => symbol === SymbolKey.W
  const wildCount = countRun(symbols, isWild)
  const lineSymbol = symbols.find((symbol) => !isWild(symbol))
  const lineCount = lineSymbol ? countRun(symbols, (symbol) => symbol === lineSymbol || isWild(symbol)) : 0

  return [
    { count: wildCount, payout: PAY_TABLE[SymbolKey.W]?.[String(wildCount)] },
    { count: lineCount, payout: lineSymbol ? PAY_TABLE[lineSymbol]?.[String(lineCount)] : undefined },
  ].reduce<{ count: number; payout: number } | undefined>(
    (best, { count, payout }) =>
      payout !== undefined && (best === undefined || payout > best.payout) ? { count, payout } : best,
    undefined
  )
}

/**
 * Ищет выигрыши по готовой сетке: у каждой активной линии берёт серию с первого барабана с заменой
 * вайлдом и оставляет линию, если такая длина есть в таблице выплат.
 */
const detectPaylines = (grid: SymbolKey[][], lineIds: string[], bet: number): Payline[] =>
  lineIds.flatMap((lineId) => {
    const line = PAYLINES[lineId]
    const result = evaluateLine(line.map((row, reel) => grid[reel][row]))

    if (result === undefined) {
      return []
    }

    return [
      {
        lineId,
        line: line.map((row, reel) => (reel < result.count ? row : null)),
        value: roundMoney(result.payout * bet),
      },
    ]
  })

/** Сумма выигрыша по найденным линиям. */
const sumPaylines = (paylines: Payline[]): number =>
  roundMoney(paylines.reduce((sum, payline) => sum + payline.value, 0))

/** Барабаны, на которых лежит вайлд. */
const findWildReels = (grid: SymbolKey[][]): number[] =>
  grid.flatMap((column, reel) => (column.includes(SymbolKey.W) ? [reel] : []))

/**
 * Цепочка респинов липкого вайлда: барабаны с W удерживаются целиком, остальные получают новые символы.
 * Новый W добавляет удержание и ещё один шаг; цепочка кончается на шаге без нового W, на MAX_RESPINS
 * или когда удержаны все барабаны.
 */
const generateRespins = (grid: SymbolKey[][], lineIds: string[], bet: number, random: Random): RespinStep[] => {
  const steps: RespinStep[] = []

  let frame = grid
  let held = findWildReels(grid)

  while (held.length > 0 && held.length < REELS && steps.length < MAX_RESPINS) {
    const stepHeld = held
    const spinning = Array.from({ length: REELS }, (_, reel) => reel).filter((reel) => !stepHeld.includes(reel))

    frame = frame.map((column, reel) => (stepHeld.includes(reel) ? [...column] : createColumn(random)))

    if (random() < RESPIN_WILD_PROBABILITY) {
      plantSymbol(frame, pickRandom(spinning, random), SymbolKey.W, random)
    }

    const paylines = detectPaylines(frame, lineIds, bet)

    steps.push({ held: stepHeld, frame, paylines, win: sumPaylines(paylines) })

    const nextHeld = findWildReels(frame)

    if (nextHeld.length === stepHeld.length) break

    held = nextHeld
  }

  return steps
}

/**
 * Разыгрывает исход спина: собирает сетку, подсаживает серию по сценарию (или с вероятностью
 * WIN_PROBABILITY), по запросу или сценарию добавляет скаттеры под anticipation и вайлд под респин,
 * детектит выигрыши по всем активным линиям и разыгрывает цепочку респинов.
 * `win` — выигрыш всего раунда: базового кадра и всех шагов респина.
 */
export const generateSpinOutcome = (
  { bet, gameMode, forceAnticipation, forceRespin }: SpinRequestPayload,
  { random, scenario }: MockOptions
): { transformations: SpinTransformation[]; win: number } => {
  const grid = createGrid(random)
  const lineIds = activeLines(gameMode)

  let winLine: number[] | undefined

  if (scenario === MockScenario.bigwin) {
    winLine = plantWin(grid, PAYLINES[lineIds[0]], random, { symbol: SymbolKey.A, count: REELS })
  } else if (scenario === MockScenario.nowin) {
    breakLines(grid, lineIds, random)
  } else if (random() < WIN_PROBABILITY) {
    winLine = plantWin(grid, PAYLINES[pickRandom(lineIds, random)], random)
  }

  if (forceAnticipation || scenario === MockScenario.anticipation) {
    plantAnticipation(grid, random, winLine)
  }

  // Случайный вайлд только в случайном сценарии: форсированные исходы остаются предсказуемыми
  if (
    forceRespin ||
    scenario === MockScenario.respin ||
    (scenario === MockScenario.random && random() < RESPIN_PROBABILITY)
  ) {
    const reel = Math.floor(random() * REELS)

    plantSymbol(grid, reel, SymbolKey.W, random, winLine?.[reel])
  }

  // Детект — единственный источник правды: подсаженная линия может задеть соседние, они тоже выиграют.
  const paylines = detectPaylines(grid, lineIds, bet)
  const win = sumPaylines(paylines)
  const anticipation = detectAnticipation(grid)
  const respins = generateRespins(grid, lineIds, bet, random)
  const transformations: SpinTransformation[] = [{ type: 'frameInit', value: grid }]

  if (anticipation.length > 0) {
    transformations.push({ type: 'anticipation', value: anticipation })
  }

  if (paylines.length > 0) {
    transformations.push({ type: 'paylines', value: paylines })
  }

  transformations.push({ type: 'win', value: win })

  if (respins.length > 0) {
    transformations.push({ type: 'respins', value: respins })
  }

  return { transformations, win: roundMoney(respins.reduce((sum, step) => sum + step.win, win)) }
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
