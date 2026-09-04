import { inject, injectable } from 'inversify'
import { notifyError } from 'src/core/errors/utils'
import type { GameEmitter } from 'src/core/events/game-emitter'
import type { Phase } from 'src/core/fsm/types'
import type { SlotApi } from 'src/games/slot/api/slot'
import type { ReelsMachineController } from 'src/games/slot/controllers/reels/reels-machine'
import type { GameEvents } from 'src/games/slot/events'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { PhaseName } from 'src/games/slot/types'

/** Фаза вращения: параллельно шлёт запрос спина и крутит барабаны, исход раунда выбирает по ответу сервера. */
@injectable()
export class SpinningPhase implements Phase<PhaseName> {
  readonly name = PhaseName.spinning

  private readonly emitter: GameEmitter<GameEvents>
  private readonly slotStore: SlotStore
  private readonly api: SlotApi
  private readonly reels: ReelsMachineController

  constructor(
    @inject(SLOT_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore,
    @inject(SLOT_TOKENS.SlotApi) api: SlotApi,
    @inject(SLOT_TOKENS.ReelsMachineController) reels: ReelsMachineController
  ) {
    this.emitter = emitter
    this.slotStore = slotStore
    this.api = api
    this.reels = reels
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.idle | typeof PhaseName.result> {
    const { bet, gameMode } = this.slotStore

    this.emitter.emit('spin:started')

    this.slotStore.setWin(0)
    this.slotStore.clearSpin()
    this.slotStore.chargeBet()
    this.reels.spin()

    try {
      this.slotStore.applySpin(await this.api.spin(bet, gameMode, signal))
    } catch (error) {
      // Отмена — не провал раунда: её разбирает движок, откатывать ставку остановленному автомату незачем
      if (signal.aborted) {
        throw error
      }

      this.slotStore.refundBet()
      notifyError(error, 'Spin failed, the bet has been refunded')

      return PhaseName.idle
    }

    return PhaseName.result
  }
}
