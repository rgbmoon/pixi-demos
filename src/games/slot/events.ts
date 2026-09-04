import type { SpinResult } from 'src/games/slot/api/slot'

/**
 * Карта событий игры: имя события → тип его payload. Единственное место, где заводятся имена, —
 * `emit` и `on` принимают только перечисленные здесь ключи, остальное отсекает компилятор.
 *
 * Именование вида `domain:action` в прошедшем времени: событие сообщает о том, что уже случилось.
 * Payload несёт только данные момента; значения, у которых есть текущее состояние (ставка, режим), живут в сторах.
 */
export type GameEvents = {
  'game:booted': void
  'ui:spinRequested': void
  'spin:started': void
  'spin:landed': SpinResult
}
