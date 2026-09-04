import { nanoid } from 'nanoid'
import { WebSocket as ReconnectingWebSocket } from 'partysocket'
import { notifyError } from 'src/errors/utils'
import { z } from 'zod'

import type { PendingRequest, PushListener, WsRequestOptions, WsTransportOptions } from './types'

// Ответ на запрос: пара { request, response }. Коррелируем по response.invocationId,
// ошибку сервера ловим по response.error.
const CompletionEnvelopeSchema = z.object({
  response: z.object({
    invocationId: z.string(),
    error: z.string().optional(),
  }),
})

// Серверный push: SignalR-invocation без invocationId, роутинг по target.
const ServerInvocationSchema = z.object({
  type: z.literal(1),
  target: z.string(),
  arguments: z.array(z.unknown()).optional(),
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
   * Резолвит его, если весь конверт `{ request, response }` сошёлся со схемой эндпоинта.
   * Реджектит, если сервер вернул `response.error` или конверт не соответствует схеме.
   */
  private settlePending(entry: PendingRequest, raw: unknown, error?: string): void {
    if (error !== undefined) {
      entry.reject(new Error(error))

      return
    }

    const parsed = entry.schema.safeParse(raw)

    if (!parsed.success) {
      entry.reject(parsed.error)

      return
    }

    entry.resolve(parsed.data)
  }

  /**
   * Доставляет серверную invocation в обработчики всех подписчиков на её `target`.
   * Подписчик пропускается, если `arguments` не сошлись с его схемой.
   */
  private dispatchPush(invocation: z.infer<typeof ServerInvocationSchema>): void {
    const set = this.listeners.get(invocation.target)
    if (!set) return

    for (const listener of set) {
      const parsed = listener.schema.safeParse(invocation.arguments ?? [])
      if (!parsed.success) continue

      try {
        listener.handler(parsed.data)
      } catch (error) {
        notifyError(error)
      }
    }
  }

  /**
   * Открывает соединение с сервером и разбирает всё, что по нему приходит: ответ на запрос уходит в `settlePending`,
   * серверная invocation — в `dispatchPush`, закрытие соединения — в `rejectAllPending`.
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

      const completion = CompletionEnvelopeSchema.safeParse(raw)

      if (completion.success) {
        const entry = this.takePending(completion.data.response.invocationId)

        if (entry) {
          this.settlePending(entry, raw, completion.data.response.error)
        }

        return
      }

      const invocation = ServerInvocationSchema.safeParse(raw)
      if (invocation.success) {
        this.dispatchPush(invocation.data)
      }
    })

    activeSocket.addEventListener('close', () => {
      this.rejectAllPending(new Error('WS connection closed'))
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
   * Шлёт invocation `target` с аргументами `args` и отдаёт промис с ответом сервера, разобранным по `schema`.
   * Реджектится ошибкой сервера, невалидным ответом, отменой через `signal` или таймаутом ожидания.
   */
  request<S extends z.ZodType>(
    target: string,
    schema: S,
    args: unknown[] = [],
    { signal }: WsRequestOptions = {}
  ): Promise<z.infer<S>> {
    const activeSocket = this.connect()
    const invocationId = nanoid()

    return new Promise<z.infer<S>>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason as Error)

        return
      }

      const lifetime = new AbortController()

      const timeoutId = setTimeout(() => {
        this.takePending(invocationId)

        reject(new Error(`WS request "${target}" timed out after ${this.timeoutMs} ms`))
      }, this.timeoutMs)

      signal?.addEventListener(
        'abort',
        () => {
          this.takePending(invocationId)

          reject(signal.reason as Error)
        },
        { once: true, signal: lifetime.signal }
      )

      this.pending.set(invocationId, {
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

          activeSocket.send(JSON.stringify({ type: 1, invocationId, target, arguments: args }))
        } catch (error) {
          this.takePending(invocationId)

          reject(error)
        }
      }

      void send()
    })
  }

  /**
   * Подписывает `handler` на серверные invocation с `target`, приходящие по инициативе сервера.
   * Возвращает функцию отписки.
   */
  subscribe<S extends z.ZodType>(target: string, schema: S, handler: (value: z.infer<S>) => void): () => void {
    this.connect()

    let set = this.listeners.get(target)
    if (!set) {
      set = new Set()
      this.listeners.set(target, set)
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
