import type { SpinResult } from 'src/types/game'

// Карта событий: имя → payload. `unknown` вместо `any` — типобезопасность не течёт.
export type EventMap = Record<string, unknown>

// Имена событий конкретной карты. `& string` отсекает symbol-ключи: имена событий — только строки.
export type EventName<E extends EventMap> = keyof E & string

/**
 * Карта событий игры. Единственное место, где заводятся имена эвентов.
 *
 *
 * Два правила именования и содержания:
 *   1. `domain:action` в ПРОШЕДШЕМ времени — событие говорит, что уже случилось.
 *      Если тянет назвать событие «сделай X» — это команда, а команда у нас
 *      выражается прямым вызовом метода контроллера (он ещё и промис вернёт).
 *   2. Событие — это МОМЕНТ, а не состояние. Всё, что имеет длительность и текущее
 *      значение (баланс, ставка, текущая фаза), живёт в MobX-сторе, а не здесь.
 */
export type GameEvents = {
  'ui:spinRequested': { bet: number }
  'spin:started': { bet: number }
  'spin:landed': SpinResult
}
