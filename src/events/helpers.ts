import type { GameEmitter } from './game-emitter'
import type { EventMap, EventName } from './types'

type WaitForOptions<P> = {
  // Отмена извне: unmount страницы, обрыв раунда. Без него зависшее ожидание живёт вечно.
  signal?: AbortSignal
  // Страховка на случай «событие не пришло никогда» (потерянный ответ сервера).
  timeoutMs?: number
  // Ждать не любое событие, а подходящее: например конкретный барабан из пяти.
  filter?: (payload: P) => boolean
}

/**
 * Отдаёт промис с payload первого события `event`, прошедшего `filter` (без фильтра — любого).
 * Реджектится, если ожидание отменили через `signal` или событие не пришло за `timeoutMs`.
 */
export const waitFor = <E extends EventMap, K extends EventName<E>>(
  emitter: GameEmitter<E>,
  event: K,
  { signal, timeoutMs, filter }: WaitForOptions<E[K]> = {}
): Promise<E[K]> =>
  new Promise<E[K]>((resolve, reject) => {
    const disposers: Array<() => void> = []

    const settle = (finish: () => void) => {
      for (const dispose of disposers) {
        dispose()
      }

      disposers.length = 0

      finish()
    }

    if (signal?.aborted) {
      reject(signal.reason as Error)

      return
    }

    disposers.push(
      emitter.on(event, (payload) => {
        if (filter && !filter(payload)) {
          return
        }

        settle(() => resolve(payload))
      })
    )

    if (signal) {
      const handleAbort = () => settle(() => reject(signal.reason as Error))

      signal.addEventListener('abort', handleAbort, { once: true })
      disposers.push(() => signal.removeEventListener('abort', handleAbort))
    }

    if (timeoutMs !== undefined) {
      // Здесь setTimeout уместен: таймаут ожидания отсчитывается системным временем и обязан
      // сработать даже в свёрнутой вкладке, где тикер PIXI остановлен.
      const timeoutId = setTimeout(() => {
        settle(() => reject(new Error(`waitFor: событие "${event}" не пришло за ${timeoutMs} мс`)))
      }, timeoutMs)

      disposers.push(() => clearTimeout(timeoutId))
    }
  })
