import type { GameInitResponse } from 'src/api/root-api'
import { WS_URL } from 'src/constants/environment'

import { INITIAL_BALANCE, PAY_TABLE, PAYLINES } from './constants'
import { createWsHandler } from './create-ws-handler'
import { buildSpinResponse, generateSpinOutcome, parseSpinPayload, randomHash, roundMoney } from './utils'

const GAME_INIT_RESULT: GameInitResponse['response']['result'] = {
  securityHash: '0000000000000000000000000000000000000000000000000000000000000000',
  currency: 'usd',
    round: {
      roundId: '019f3824-933b-747c-91a4-f29ea8541643',
      bet: 0.01,
      balance: INITIAL_BALANCE,
      totalWin: 0,
      platformMaxWin: null,
      endedUtc: '2026-07-06T15:55:48.9230832Z',
      SpinResponse: {
        transformations: [
          {
            type: 'frameInit',
            value: [
              ['K', 'L', 'M'],
              ['N', 'O', 'P'],
              ['L', 'M', 'K'],
              ['P', 'N', 'O'],
              ['M', 'K', 'L'],
            ],
          },
        ],
      },
      freeRoundCampaign: null,
    },
    gameSettings: {
      paylines: PAYLINES,
      payTable: PAY_TABLE,
      availableGameModes: [
        { gameMode: 0, name: 'Line1', type: 'None' },
        { gameMode: 1, name: 'Line3', type: 'LuckyBet' },
        { gameMode: 2, name: 'Line5', type: 'LuckyBet' },
        { gameMode: 3, name: 'Line7', type: 'LuckyBet' },
        { gameMode: 4, name: 'Line10', type: 'LuckyBet' },
      ],
      allowedLuckyBets: [
        { gameMode: 1, coefficient: 3, bets: [0.03, 0.06, 0.15, 0.3, 0.6, 1.5, 3, 6, 15, 30, 60, 150, 300, 450] },
        { gameMode: 2, coefficient: 5, bets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 25, 50, 100, 250, 500, 750] },
        { gameMode: 3, coefficient: 7, bets: [0.07, 0.14, 0.35, 0.7, 1.4, 3.5, 7, 14, 35, 70, 140, 350, 700, 1050] },
        { gameMode: 4, coefficient: 10, bets: [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 1500] },
      ],
      coinCoefficient: 0.01,
      defaultBetIndex: 0,
      allowedBets: [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 150],
      availableAutoSpinCounts: [5, 10, 15, 20, 25, 50, 75, 100, 999],
      rtpOptions: [
        { rtp: 95.83, gameMode: 'Lines1', volatility: 'Medium' },
        { rtp: 96.08, gameMode: 'Lines3', volatility: 'Medium' },
        { rtp: 95.92, gameMode: 'Lines5', volatility: 'Medium' },
        { rtp: 95.91, gameMode: 'Lines7', volatility: 'Medium' },
        { rtp: 96.19, gameMode: 'Lines10', volatility: 'Medium' },
      ],
      locales: ['EN'],
      platformMaxWin: null,
      currencyMinimalUnit: 0.01,
    },
    freeRoundCampaign: null,
    gamificationToken:
      'MOCK_GAMIFICATION_TOKEN',
    isDemo: false,
}

// Мок не входит в DI-граф — накопление раунда держим в модульных переменных.
let balance = INITIAL_BALANCE
let totalWin = 0

export const handlers = [
  createWsHandler({
    url: WS_URL,
    endpoints: {
      initGame: (_args, reply) => {
        reply({
          ...GAME_INIT_RESULT,
          securityHash: randomHash(),
          round: {
            ...GAME_INIT_RESULT.round,
            roundId: crypto.randomUUID(),
            endedUtc: new Date().toISOString(),
          },
        })
      },
      spin: (args, reply) => {
        const { bet, gameMode } = parseSpinPayload(args[0])

        balance = roundMoney(balance - bet)

        const { transformations, win } = generateSpinOutcome(bet, gameMode)

        if (win > 0) {
          balance = roundMoney(balance + win)
          totalWin = roundMoney(totalWin + win)
        }

        reply(buildSpinResponse({ bet, balance, totalWin, transformations }))
      },
    },
  }),
]
