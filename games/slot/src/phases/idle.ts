import { inject, injectable } from 'inversify'

import type { GameEvents } from '#src/events'
import type { SlotStore } from '#src/stores/slot'
import { SLOT_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { Phase } from '@pixi-demos/core/fsm/types'

/** Фаза ожидания игрока: спит до события `ui:spinRequested`, пришедшего, когда спин доступен. */
@injectable()
export class IdlePhase implements Phase<PhaseName> {
  readonly name = PhaseName.idle

  private readonly emitter: GameEmitter<GameEvents>
  private readonly slotStore: SlotStore

  constructor(
    @inject(SLOT_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore
  ) {
    this.emitter = emitter
    this.slotStore = slotStore
  }

  // Возвращаемый тип сужен до реальных целей фазы — граф переходов проверяет компилятор
  async enter(signal: AbortSignal): Promise<typeof PhaseName.spinning> {
    // Доступность спина проверяет фаза: запрос в обход кнопки не спишет ставку без денег или при открытых настройках
    await this.emitter.waitFor('ui:spinRequested', { signal, filter: () => this.slotStore.canSpin })

    return PhaseName.spinning
  }
}
