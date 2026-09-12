import { inject, injectable } from 'inversify'
import type { GameEmitter } from 'src/core/events/game-emitter'
import type { Phase } from 'src/core/fsm/types'
import type { HoldWinController } from 'src/games/slot/controllers/reels/hold-win'
import type { ReelsMachineController } from 'src/games/slot/controllers/reels/reels-machine'
import type { GameEvents } from 'src/games/slot/events'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { PhaseName } from 'src/games/slot/types'

/**
 * Конец бонуса Hold & Win: собирает монеты поля, закрывает бонус в сторе и возвращает доску барабанов.
 * Выигрыш бонуса дальше показывает и зачисляет `result` как выигрыш шага раунда.
 */
@injectable()
export class HoldWinCollectPhase implements Phase<PhaseName> {
  readonly name = PhaseName.holdWinCollect

  private readonly emitter: GameEmitter<GameEvents>
  private readonly slotStore: SlotStore
  private readonly reels: ReelsMachineController
  private readonly holdWin: HoldWinController

  constructor(
    @inject(SLOT_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore,
    @inject(SLOT_TOKENS.ReelsMachineController) reels: ReelsMachineController,
    @inject(SLOT_TOKENS.HoldWinController) holdWin: HoldWinController
  ) {
    this.emitter = emitter
    this.slotStore = slotStore
    this.reels = reels
    this.holdWin = holdWin
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.result> {
    const holdWin = this.slotStore.spinHoldWin

    if (!holdWin) {
      throw new Error('Hold & Win collect phase entered without a bonus')
    }

    await this.holdWin.collect(signal)

    this.slotStore.collectHoldWin()
    this.emitter.emit('holdWin:collected', holdWin)

    await Promise.all([this.holdWin.hide(signal), this.reels.show(signal)])

    return PhaseName.result
  }
}
