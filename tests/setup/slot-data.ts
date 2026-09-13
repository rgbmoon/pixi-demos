import type { GameInitResult } from 'src/games/slot/api/slot'
import { SymbolKey } from 'src/games/slot/types'

/** Ставки режима по умолчанию (`gameMode: '4'`). */
export const BETS = [10, 20, 50, 100]
/** Ставки режима `'3'`: другие значения, та же длина — на ней стоит перенос индекса между режимами. */
export const MODE_3_BETS = [7, 14, 35, 70]
export const DEFAULT_BET_INDEX = 2
export const INITIAL_BALANCE = 1000

/** Сетка 5×3 из одного символа: раунд без выигрыша, если линии не подставлены отдельно. */
const createSymbols = (key: SymbolKey = SymbolKey.A): SymbolKey[][] =>
  Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => key))

export const createInitResult = (overrides: Partial<GameInitResult['round']> = {}): GameInitResult => ({
  securityHash: 'HASH',
  currency: 'USD',
  round: {
    roundId: 'round-0',
    bet: BETS[DEFAULT_BET_INDEX],
    balance: INITIAL_BALANCE,
    totalWin: 0,
    platformMaxWin: null,
    endedUtc: '2026-01-01T00:00:00.000Z',
    SpinResponse: { transformations: [{ type: 'frameInit', value: createSymbols() }] },
    freeRoundCampaign: null,
    ...overrides,
  },
  gameSettings: {
    paylines: { '0': [1, 1, 1, 1, 1] },
    payTable: { A: { '3': 30 } },
    availableGameModes: [
      { gameMode: '0', name: 'Line1', type: 'None' },
      { gameMode: '1', name: 'Line3', type: 'LuckyBet' },
      { gameMode: '2', name: 'Line5', type: 'LuckyBet' },
      { gameMode: '3', name: 'Line7', type: 'LuckyBet' },
      { gameMode: '4', name: 'Line10', type: 'LuckyBet' },
    ],
    allowedLuckyBets: [
      { gameMode: '1', coefficient: 3, bets: BETS },
      { gameMode: '2', coefficient: 5, bets: BETS },
      { gameMode: '3', coefficient: 7, bets: MODE_3_BETS },
      { gameMode: '4', coefficient: 10, bets: BETS },
    ],
    coinCoefficient: 1,
    defaultBetIndex: DEFAULT_BET_INDEX,
    allowedBets: BETS,
    availableAutoSpinCounts: [10, 20],
    rtpOptions: [{ rtp: 96, gameMode: '4', volatility: 'High' }],
    locales: ['en'],
    platformMaxWin: null,
    currencyMinimalUnit: 0.01,
  },
  freeRoundCampaign: null,
  gamificationToken: 'TOKEN',
  isDemo: true,
})
