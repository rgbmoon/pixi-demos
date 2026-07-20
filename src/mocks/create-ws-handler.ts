import { ws } from 'msw'

import type { CreateWsHandlerOptions, WsDelayRange } from './types'

// Границы искусственной задержки ответа (мс) — симуляция сетевой латентности.
const DEFAULT_RESPONSE_DELAY: WsDelayRange = { min: 100, max: 300 }

const randomDelay = ({ min, max }: WsDelayRange) => min + Math.random() * (max - min)

export const createWsHandler = ({ url, endpoints, delays, onConnect }: CreateWsHandlerOptions) =>
  ws.link(url).addEventListener('connection', ({ client }) => {
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

      // Отправка ответа с задержкой: setTimeout легален — это латентность мока по системному времени, не игровая пауза.
      const scheduleSend = (data: string) =>
        setTimeout(() => client.send(data), randomDelay(delays?.[message.target] ?? DEFAULT_RESPONSE_DELAY))

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
