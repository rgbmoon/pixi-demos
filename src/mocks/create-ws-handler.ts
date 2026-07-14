import { ws } from 'msw'

import type { CreateWsHandlerOptions } from './types'

export const createWsHandler = ({ url, endpoints, onConnect }: CreateWsHandlerOptions) =>
  ws.link(url).addEventListener('connection', ({ client }) => {
    onConnect?.({
      push: (type, payload) => client.send(JSON.stringify({ type, payload })),
      onClose: (cleanup) => client.addEventListener('close', () => cleanup()),
    })

    client.addEventListener('message', (event) => {
      const message = JSON.parse(event.data as string) as {
        id?: string
        type: string
        payload?: unknown
      }

      // Диспатч по type: неизвестные сообщения молча игнорируем.
      const endpoint = endpoints[message.type]
      if (!endpoint) {
        return
      }

      endpoint(
        message.payload,
        (type, payload) => client.send(JSON.stringify({ id: message.id, type, payload })),
        (code, errorMessage) =>
          client.send(JSON.stringify({ id: message.id, type: message.type, error: { code, message: errorMessage } }))
      )
    })
  })
