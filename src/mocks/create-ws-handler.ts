import { ws } from 'msw'

import type { CreateWsHandlerOptions } from './types'

// Границы искусственной задержки ответа (мс) — симуляция сетевой латентности.
const RESPONSE_DELAY_MIN = 100
const RESPONSE_DELAY_MAX = 300

const randomDelay = () => RESPONSE_DELAY_MIN + Math.random() * (RESPONSE_DELAY_MAX - RESPONSE_DELAY_MIN)

export const createWsHandler = ({ url, endpoints, onConnect }: CreateWsHandlerOptions) =>
  ws.link(url).addEventListener('connection', ({ client }) => {
    // Отправка ответа с задержкой: setTimeout легален — это латентность мока по системному времени, не игровая пауза.
    const scheduleSend = (data: string) => setTimeout(() => client.send(data), randomDelay())

    onConnect?.({
      push: (target, args) => client.send(JSON.stringify({ type: 1, target, arguments: args })),
      onClose: (cleanup) => client.addEventListener('close', () => cleanup()),
    })

    client.addEventListener('message', (event) => {
      const message = JSON.parse(event.data as string) as {
        type: number
        invocationId: string
        target: string
        arguments?: unknown[]
      }

      // Диспатч по target: неизвестные invocation молча игнорируем.
      const endpoint = endpoints[message.target]
      if (!endpoint) {
        return
      }

      endpoint(
        message.arguments ?? [],
        (result) =>
          scheduleSend(
            JSON.stringify({ request: message, response: { type: 3, invocationId: message.invocationId, result } })
          ),
        (error) =>
          scheduleSend(
            JSON.stringify({ request: message, response: { type: 3, invocationId: message.invocationId, error } })
          )
      )
    })
  })
