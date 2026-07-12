import { WS_URL } from 'src/constants/environment'

import { createWsHandler } from './create-ws-handler'

const SYMBOLS_COUNT = 3
const SYMBOL_VARIANTS = 5

const rollSymbols = (): number[] =>
  Array.from({ length: SYMBOLS_COUNT }, () => Math.floor(Math.random() * SYMBOL_VARIANTS))

const calculateWin = (symbols: number[], bet: number): number =>
  symbols.every((symbol) => symbol === symbols[0]) ? bet * 10 : 0

export const handlers = [
  createWsHandler({
    url: WS_URL,
    endpoints: {
      spin: (payload, reply) => {
        const { bet = 0 } = payload as { bet?: number }
        const symbols = rollSymbols()

        reply('spinResult', { symbols, win: calculateWin(symbols, bet) })
      },
    },
  }),
]
