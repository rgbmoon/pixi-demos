import type { SpinResult } from 'src/types/game'

export type AnyHandler = (payload: unknown) => void

export type EventMap = Record<string, unknown>

export type EventName<E extends EventMap> = keyof E & string

/**
 * Карта событий игры: имя события → тип его payload. Единственное место, где заводятся имена, —
 * `emit` и `on` принимают только перечисленные здесь ключи, остальное отсекает компилятор.
 *
 * Именование вида `domain:action` в прошедшем времени: событие сообщает о том, что уже случилось.
 */
export type GameEvents = {
  'ui:spinRequested': { bet: number }
  'spin:started': { bet: number }
  'spin:landed': SpinResult
}
