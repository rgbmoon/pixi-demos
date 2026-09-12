import type { CascadeStep, HoldWin, HoldWinStep, RespinStep, SpinResult } from 'src/games/slot/api/slot'
import type { CoinValue } from 'src/games/slot/types'

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
  'ui:stopRequested': void
  'ui:buttonTapped': void
  'spin:started': void
  'reel:landed': { reel: number }
  'reel:anticipationStarted': { reel: number }
  'credit:toppedUp': void
  'spin:landed': SpinResult
  'respin:started': { held: readonly number[] }
  'respin:landed': RespinStep
  'holdWin:started': void
  'holdWin:spinStarted': { held: HoldWinStep['held'] }
  'holdWin:cellLanded': { reel: number; row: number; value: CoinValue }
  'holdWin:landed': HoldWinStep
  'holdWin:collected': HoldWin
  'cascade:started': { removed: CascadeStep['removed'] }
  'cascade:landed': CascadeStep
}
