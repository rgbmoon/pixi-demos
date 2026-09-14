import { inject, injectable } from 'inversify'
import type { GameEmitter } from 'src/core/events/game-emitter'
import type { Phase } from 'src/core/fsm/types'
import { HOLD_WIN_COLLECT_STAGGER_MS } from 'src/games/slot/constants'
import type { HoldWinMachineController } from 'src/games/slot/controllers/reels/hold-win-machine'
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
  private readonly reelsMachine: ReelsMachineController
  private readonly holdWinMachine: HoldWinMachineController

  constructor(
    @inject(SLOT_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore,
    @inject(SLOT_TOKENS.ReelsMachineController) reelsMachine: ReelsMachineController,
    @inject(SLOT_TOKENS.HoldWinMachineController) holdWinMachine: HoldWinMachineController
  ) {
    this.emitter = emitter
    this.slotStore = slotStore
    this.reelsMachine = reelsMachine
    this.holdWinMachine = holdWinMachine
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.result> {
    const holdWin = this.slotStore.spinHoldWin

    if (!holdWin) {
      throw new Error('Hold & Win collect phase entered without a bonus')
    }

    // Турбо поднимает монеты разом
    await this.holdWinMachine.collect(this.slotStore.isTurboEnabled ? 0 : HOLD_WIN_COLLECT_STAGGER_MS, signal)

    this.slotStore.collectHoldWin()
    this.emitter.emit('holdWin:collected', holdWin)

    await Promise.all([this.holdWinMachine.hide(signal), this.reelsMachine.show(signal)])

    return PhaseName.result
  }
}
