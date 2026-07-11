import { WS_URL } from 'src/constants/environment'

import { createWsHandler } from './create-ws-handler'

let balance = 1000

export const handlers = [
  createWsHandler({
    url: WS_URL,
    endpoints: {
      ping: (_payload, reply) => reply('pong', { message: 'hello world', time: Date.now() }),
      getBalance: (_payload, reply) => reply('balance', { amount: balance }),
      deposit: (payload, reply) => {
        const { amount = 0 } = payload as { amount?: number }
        balance += amount
        reply('balance', { amount: balance })
      },
    },
    onConnect: ({ push, onClose }) => {
      let count = 0
      const interval = setInterval(() => {
        count += 1
        push('tick', { count })
      }, 1000)
      onClose(() => clearInterval(interval))
    },
  }),
]
