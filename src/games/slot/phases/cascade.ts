import { inject, injectable } from 'inversify'
import type { GameEmitter } from 'src/core/events/game-emitter'
import type { Phase } from 'src/core/fsm/types'
import type { ReelsMachineController } from 'src/games/slot/controllers/reels/reels-machine'
import type { GameEvents } from 'src/games/slot/events'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { PhaseName } from 'src/games/slot/types'

/**
 * Фаза каскада: взрывает выигравшие символы, переводит раунд на следующий шаг каскада из ответа сервера
 * и сажает падение на кадр шага. Сети и ставки нет. Пока фаза идёт, нажатие Stop ускоряет падение.
 */
@injectable()
export class CascadePhase implements Phase<PhaseName> {
  readonly name = PhaseName.cascade

  private readonly emitter: GameEmitter<GameEvents>
  private readonly slotStore: SlotStore
  private readonly reelsMachine: ReelsMachineController

  constructor(
    @inject(SLOT_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore,
    @inject(SLOT_TOKENS.ReelsMachineController) reelsMachine: ReelsMachineController
  ) {
    this.emitter = emitter
    this.slotStore = slotStore
    this.reelsMachine = reelsMachine
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.result> {
    const step = this.slotStore.nextCascade

    // В каскад раунд переводит только result, когда в ответе есть следующий шаг
    if (!step) {
      throw new Error('Cascade phase entered without a cascade step')
    }

    // Stop принимается, пока идёт фаза и Stop доступен по стору: подписку снимает scope. Stop во время
    // взрыва машина запоминает и проматывает падение с его старта
    const scope = new AbortController()

    this.emitter.on(
      'ui:stopRequested',
      () => {
        if (this.slotStore.canStop) this.reelsMachine.slam()
      },
      { signal: scope.signal }
    )

    try {
      this.emitter.emit('cascade:started', { removed: step.removed })

      await this.reelsMachine.explode(step.removed, signal)

      // Шаг переключается между взрывом и падением: множитель шага появляется до новых символов
      this.slotStore.advanceCascadeStep()

      await this.reelsMachine.cascade(step.frame, step.removed, signal)

      this.emitter.emit('cascade:landed', step)

      return PhaseName.result
    } finally {
      scope.abort()
    }
  }
}
