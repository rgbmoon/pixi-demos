import { WebSocket as ReconnectingWebSocket } from 'partysocket'
import { WS_URL } from 'src/constants/environment'
import type { PendingRequest, PushListener } from 'src/types/network'
import { z } from 'zod'

const EnvelopeSchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  payload: z.unknown(),
})

const DEFAULT_TIMEOUT_MS = 10000

type CreateWsTransportOptions = {
  url?: string
  timeoutMs?: number
}

export const createWsTransport = ({ url = WS_URL, timeoutMs = DEFAULT_TIMEOUT_MS }: CreateWsTransportOptions = {}) => {
  let socket: ReconnectingWebSocket | null = null
  const pending = new Map<string, PendingRequest>()
  const listeners = new Map<string, Set<PushListener>>()
  let counter = 0

  const nextId = (): string => {
    counter += 1

    return String(counter)
  }

  const takePending = (id: string): PendingRequest | undefined => {
    const entry = pending.get(id)

    if (entry) {
      pending.delete(id)
      clearTimeout(entry.timeoutId)
    }

    return entry
  }

  const rejectAllPending = (reason: Error): void => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timeoutId)

      entry.reject(reason)
    }

    pending.clear()
  }

  const connect = (): ReconnectingWebSocket => {
    if (socket) {
      return socket
    }

    const activeSocket = new ReconnectingWebSocket(url)
    socket = activeSocket

    activeSocket.addEventListener('message', (event) => {
      const envelope = EnvelopeSchema.parse(JSON.parse(event.data as string))

      if (envelope.id !== undefined) {
        const entry = takePending(envelope.id)

        if (entry) {
          try {
            entry.resolve(entry.schema.parse(envelope.payload))
          } catch (error) {
            // ZodError (или иная ошибка парсинга) — считаем запрос проваленным.
            entry.reject(error)
          }

          return
        }
      }

      const set = listeners.get(envelope.type)
      if (!set) return

      for (const listener of set) {
        listener.handler(listener.schema.parse(envelope.payload))
      }
    })

    activeSocket.addEventListener('close', () => {
      rejectAllPending(new Error('WS-соединение закрыто'))
    })

    return activeSocket
  }

  const whenOpen = (activeSocket: ReconnectingWebSocket): Promise<void> => {
    if (activeSocket.readyState === activeSocket.OPEN) {
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      activeSocket.addEventListener('open', () => resolve(), { once: true })
    })
  }

  const request = <S extends z.ZodType>(type: string, schema: S, payload?: unknown): Promise<z.infer<S>> => {
    const activeSocket = connect()
    const id = nextId()

    return new Promise<z.infer<S>>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`WS-запрос "${type}" не ответил за ${timeoutMs} мс`))
      }, timeoutMs)

      pending.set(id, { resolve: resolve as (value: unknown) => void, reject, schema, timeoutId })

      const send = async (): Promise<void> => {
        try {
          await whenOpen(activeSocket)

          activeSocket.send(JSON.stringify({ id, type, payload }))
        } catch (error) {
          takePending(id)

          reject(error)
        }
      }

      void send()
    })
  }

  const subscribe = <S extends z.ZodType>(
    type: string,
    schema: S,
    handler: (value: z.infer<S>) => void
  ): (() => void) => {
    connect()

    let set = listeners.get(type)
    if (!set) {
      set = new Set()
      listeners.set(type, set)
    }

    const listener: PushListener = { schema, handler: handler as (value: unknown) => void }
    set.add(listener)

    return () => {
      set.delete(listener)
    }
  }

  const disconnect = (): void => {
    socket?.close()
    socket = null
  }

  return { request, subscribe, disconnect }
}

const defaultTransport = createWsTransport()
export const { request, subscribe } = defaultTransport
