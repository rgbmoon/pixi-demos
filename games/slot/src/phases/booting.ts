import { inject, injectable } from 'inversify'

import type { SlotApi } from '#src/api/slot'
import type { GameEvents } from '#src/events'
import type { SlotStore } from '#src/stores/slot'
import { SLOT_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { Phase } from '@pixi-demos/core/fsm/types'

/**
 * Стартовая фаза: запрашивает данные раунда, кладёт их в стор и объявляет игру готовой.
 * Ошибку не ловит — без данных раунда игра не работает, и движок объявит её фатальной.
 */
@injectable()
export class BootingPhase implements Phase<PhaseName> {
  readonly name = PhaseName.booting

  private readonly api: SlotApi
  private readonly slotStore: SlotStore
  private readonly emitter: GameEmitter<GameEvents>

  constructor(
    @inject(SLOT_TOKENS.SlotApi) api: SlotApi,
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore,
    @inject(SLOT_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>
  ) {
    this.api = api
    this.slotStore = slotStore
    this.emitter = emitter
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.idle> {
    const result = await this.api.initGame(signal)

    this.slotStore.applyInit(result)

    // Барабаны наполняются реактивно по initialSymbols, поэтому готовность объявляется после записи в стор
    this.emitter.emit('game:booted')

    return PhaseName.idle
  }
}
