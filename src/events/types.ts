import type { SpinResponse } from 'src/api/root-api'

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

/**
 * Карта событий игры: имя события → тип его payload. Единственное место, где заводятся имена, —
 * `emit` и `on` принимают только перечисленные здесь ключи, остальное отсекает компилятор.
 *
 * Именование вида `domain:action` в прошедшем времени: событие сообщает о том, что уже случилось.
 * Payload несёт только данные момента; значения, у которых есть текущее состояние (ставка, режим), живут в сторах.
 */
export type GameEvents = {
  'ui:spinRequested': void
  'spin:started': void
  'spin:landed': SpinResponse
}
