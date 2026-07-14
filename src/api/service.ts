import { nanoid } from 'nanoid'
import { WebSocket as ReconnectingWebSocket } from 'partysocket'
import { z } from 'zod'

import type { PendingRequest, PushListener, WsRequestOptions, WsTransportOptions } from './types'

const EnvelopeSchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  payload: z.unknown(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
})

/**
 * Обертка вокруг partysocket, предоставляющая методы для удобной работы с сетью
 */
export class WsTransport {
  private socket: ReconnectingWebSocket | null = null

  private readonly pending = new Map<string, PendingRequest>()
  private readonly listeners = new Map<string, Set<PushListener>>()
  private readonly url: string
  private readonly timeoutMs: number

  constructor({ url, timeoutMs = 10000 }: WsTransportOptions) {
    this.url = url
    this.timeoutMs = timeoutMs
  }

  /**
   * Забирает запись ожидающего запроса по id и снимает её с учёта вместе с таймером и слушателями.
   * Возвращает `undefined`, если запрос уже был завершён.
   */
  private takePending(id: string): PendingRequest | undefined {
    const entry = this.pending.get(id)

    if (entry) {
      this.pending.delete(id)
      entry.dispose()
    }

    return entry
  }

  /**
   * Реджектит все запросы, ждущие ответа, указанной причиной — используется при закрытии сокета.
   */
  private rejectAllPending(reason: Error): void {
    for (const entry of this.pending.values()) {
      entry.dispose()

      entry.reject(reason)
    }

    this.pending.clear()
  }

  /**
   * Завершает промис запроса пришедшим ответом:
   * Резолвит его, если payload сошёлся со схемой запроса.
   * Реджектит, если сервер вернул ошибку или payload не соответствует схеме.
   */
  private settlePending(entry: PendingRequest, envelope: z.infer<typeof EnvelopeSchema>): void {
    if (envelope.error) {
      entry.reject(new Error(`${envelope.error.code}: ${envelope.error.message}`))

      return
    }

    const parsed = entry.schema.safeParse(envelope.payload)

    if (!parsed.success) {
      entry.reject(parsed.error)

      return
    }

    entry.resolve(parsed.data)
  }

  /**
   * Доставляет сообщение, пришедшее по инициативе сервера, в обработчики всех подписчиков на его `type`.
   * Подписчик пропускается, если payload не сошёлся с его схемой.
   */
  private dispatchPush(envelope: z.infer<typeof EnvelopeSchema>): void {
    const set = this.listeners.get(envelope.type)
    if (!set) return

    for (const listener of set) {
      const parsed = listener.schema.safeParse(envelope.payload)
      if (!parsed.success) continue

      try {
        listener.handler(parsed.data)
      } catch {
        // Ошибка внутри чужого обработчика — не повод глушить остальных подписчиков.
      }
    }
  }

  /**
   * Открывает соединение с сервером и разбирает всё, что по нему приходит: ответ на запрос уходит в `settlePending`,
   * сообщение без запроса — в `dispatchPush`, закрытие соединения — в `rejectAllPending`.
   */
  private createSocket(): ReconnectingWebSocket {
    const activeSocket = new ReconnectingWebSocket(this.url)

    activeSocket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return

      let raw: unknown

      try {
        raw = JSON.parse(event.data)
      } catch {
        return
      }

      const envelope = EnvelopeSchema.safeParse(raw)
      if (!envelope.success) return

      const { data } = envelope

      if (data.id !== undefined) {
        const entry = this.takePending(data.id)

        if (entry) {
          this.settlePending(entry, data)

          return
        }
      }

      this.dispatchPush(data)
    })

    activeSocket.addEventListener('close', () => {
      this.rejectAllPending(new Error('WS-соединение закрыто'))
    })

    return activeSocket
  }

  /**
   * Отдаёт сокет, либо возвращая существующий, либо создавая новый экземпляр
   */
  private connect(): ReconnectingWebSocket {
    if (this.socket === null) {
      this.socket = this.createSocket()
    }

    return this.socket
  }

  /**
   * Ждёт, пока сокет откроется, — чтобы запрос, начатый раньше подключения, не потерялся.
   * Реджектится, если запрос завершился (`lifetime`) до открытия.
   */
  private whenOpen(activeSocket: ReconnectingWebSocket, lifetime: AbortSignal): Promise<void> {
    if (activeSocket.readyState === activeSocket.OPEN) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      activeSocket.addEventListener('open', () => resolve(), { once: true, signal: lifetime })

      lifetime.addEventListener('abort', () => reject(lifetime.reason as Error), { once: true })
    })
  }

  /**
   * Шлёт запрос `type` и отдаёт промис с ответом сервера, разобранным по `schema`.
   * Реджектится ошибкой сервера, невалидным ответом, отменой через `signal` или таймаутом ожидания.
   */
  request<S extends z.ZodType>(
    type: string,
    schema: S,
    payload?: unknown,
    { signal }: WsRequestOptions = {}
  ): Promise<z.infer<S>> {
    const activeSocket = this.connect()
    const id = nanoid()

    return new Promise<z.infer<S>>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason as Error)

        return
      }

      const lifetime = new AbortController()

      const timeoutId = setTimeout(() => {
        this.takePending(id)

        reject(new Error(`WS-запрос "${type}" не ответил за ${this.timeoutMs} мс`))
      }, this.timeoutMs)

      signal?.addEventListener(
        'abort',
        () => {
          this.takePending(id)

          reject(signal.reason as Error)
        },
        { once: true, signal: lifetime.signal }
      )

      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        schema,
        dispose: () => {
          clearTimeout(timeoutId)
          lifetime.abort()
        },
      })

      const send = async (): Promise<void> => {
        try {
          await this.whenOpen(activeSocket, lifetime.signal)

          activeSocket.send(JSON.stringify({ id, type, payload }))
        } catch (error) {
          this.takePending(id)

          reject(error)
        }
      }

      void send()
    })
  }

  /**
   * Подписывает `handler` на push-сообщения `type`, приходящие по инициативе сервера.
   * Возвращает функцию отписки.
   */
  subscribe<S extends z.ZodType>(type: string, schema: S, handler: (value: z.infer<S>) => void): () => void {
    this.connect()

    let set = this.listeners.get(type)
    if (!set) {
      set = new Set()
      this.listeners.set(type, set)
    }

    const listener: PushListener = { schema, handler: handler as (value: unknown) => void }
    set.add(listener)

    return () => {
      set.delete(listener)
    }
  }

  /**
   * Закрывает соединение; висящие запросы реджектятся, следующий `request`/`subscribe` подключится заново.
   */
  disconnect(): void {
    this.socket?.close()
    this.socket = null
  }
}
