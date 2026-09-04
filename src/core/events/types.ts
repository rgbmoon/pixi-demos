export type AnyHandler = (payload: unknown) => void

export type WaitForOptions<P> = {
  // Отмена извне: unmount страницы, обрыв раунда. Без него зависшее ожидание живёт вечно.
  signal?: AbortSignal
  // Страховка на случай «событие не пришло никогда» (потерянный ответ сервера).
  timeoutMs?: number
  // Ждать не любое событие, а подходящее: например конкретный барабан из пяти.
  filter?: (payload: P) => boolean
}

export type EventMap = Record<string, unknown>

export type EventName<E extends EventMap> = keyof E & string

/** Хвост аргументов `emit`: событие с payload `void` вызывается одним именем. */
export type EmitArgs<E extends EventMap, K extends EventName<E>> = E[K] extends void ? [] : [payload: E[K]]

