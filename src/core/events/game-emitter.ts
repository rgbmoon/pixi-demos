import EventEmitter from 'eventemitter3'

import type { AnyHandler, EmitArgs, EventMap, EventName, WaitForOptions } from './types'

/**
 * Типизированный эмиттер игровых событий: имена и payload'ы типизированы, эмит произвольной строки невозможен.
 *
 * Под капотом — eventemitter3: PIXI тянет его же, поэтому в бандле он один, а слой событий обходится без PIXI.
 * Обёртка добавляет к нему три недостающие вещи:
 *   1. on() отдаёт функцию отписки вместо `this` — не нужно хранить ссылку на колбэк ради off();
 *   2. ожидание события промисом (метод waitFor);
 *   3. точку, куда вешается общий лог всех событий: wildcard-подписки у ee3 нет.
 */
export class GameEmitter<E extends EventMap> {
  private readonly emitter = new EventEmitter<Record<string, [unknown]>>()
  private readonly trace?: (event: string, payload: unknown) => void

  constructor(trace?: (event: string, payload: unknown) => void) {
    this.trace = trace
  }

  /**
   * Подписывает `handler` на событие `event`.
   * Возвращает функцию отписки — её обязан вызвать владелец подписки.
   */
  on<K extends EventName<E>>(event: K, handler: (payload: E[K]) => void): () => void {
    this.emitter.on(event, handler as AnyHandler)

    return () => {
      this.emitter.off(event, handler as AnyHandler)
    }
  }

  /** Доставляет `payload` всем, кто подписан на `event`, и отдаёт то же событие в трассировку. */
  emit<K extends EventName<E>>(event: K, ...args: EmitArgs<E, K>): void {
    // Кортеж-хвост нужен ради событий без payload; внутри метода K не разрешён, поэтому элемент достаём приведением
    const [payload] = args as [E[K]?]

    this.trace?.(event, payload)

    this.emitter.emit(event, payload)
  }

  /**
   * Отдаёт промис с payload первого события `event`, прошедшего `filter` (без фильтра — любого).
   * Реджектится, если ожидание отменили через `signal` или событие не пришло за `timeoutMs`.
   */
  waitFor<K extends EventName<E>>(event: K, { signal, timeoutMs, filter }: WaitForOptions<E[K]> = {}): Promise<E[K]> {
    return new Promise<E[K]>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason as Error)

        return
      }

      const offEvent = this.on(event, (payload) => {
        if (filter && !filter(payload)) {
          return
        }

        cleanup()
        resolve(payload)
      })

      const handleAbort = () => {
        cleanup()
        reject(signal?.reason as Error)
      }

      signal?.addEventListener('abort', handleAbort, { once: true })

      // Таймаут ожидания отсчитывается системным временем и обязан
      // сработать даже в свёрнутой вкладке, где тикер PIXI остановлен.
      const timeoutId =
        timeoutMs !== undefined
          ? setTimeout(() => {
              cleanup()
              reject(new Error(`waitFor: event "${event}" did not arrive within ${timeoutMs} ms`))
            }, timeoutMs)
          : undefined

      function cleanup() {
        offEvent()
        signal?.removeEventListener('abort', handleAbort)
        clearTimeout(timeoutId)
      }
    })
  }

  /**
   * Отдаёт число живых подписчиков по каждому событию — инструмент диагностики утечек.
   * Числа стабильны от раунда к раунду; рост означает, что кто-то не вызвал свою функцию отписки.
   */
  listenerCounts(): Record<string, number> {
    const counts: Record<string, number> = {}

    for (const event of this.emitter.eventNames()) {
      counts[event] = this.emitter.listenerCount(event)
    }

    return counts
  }
}
