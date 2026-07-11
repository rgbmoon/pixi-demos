import { ws } from 'msw'

export type WsReply = (type: string, payload: unknown) => void
export type WsEndpoint = (payload: unknown, reply: WsReply) => void

export type WsConnectionContext = {
  push: (type: string, payload: unknown) => void
  onClose: (cleanup: () => void) => void
}

type CreateWsHandlerOptions = {
  url: string
  endpoints: Record<string, WsEndpoint>
  onConnect?: (context: WsConnectionContext) => void
}

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

      endpoint(message.payload, (type, payload) => client.send(JSON.stringify({ id: message.id, type, payload })))
    })
  })
