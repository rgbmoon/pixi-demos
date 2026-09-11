import { inject, injectable } from 'inversify'
import { notifyError } from 'src/core/errors/utils'
import type { GameEmitter } from 'src/core/events/game-emitter'
import type { Phase } from 'src/core/fsm/types'
import type { SlotApi, SpinResult } from 'src/games/slot/api/slot'
import type { ReelsMachineController } from 'src/games/slot/controllers/reels/reels-machine'
import type { GameEvents } from 'src/games/slot/events'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { PhaseName } from 'src/games/slot/types'

/**
 * Фаза вращения: держит барабаны в движении от старта до посадки. Параллельно шлёт запрос спина,
 * сажает барабаны на ответ сервера и объявляет `spin:landed`. Пока фаза идёт, нажатие Stop ускоряет посадку.
 */
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
    // Доска до спина: на неё барабаны вернутся, если сервер не ответит
    const board = this.slotStore.spinSymbols ?? this.slotStore.initialSymbols
    // Прошлый ответ сервера: его балансом закрывается серия, если спин провалится
    const previousResult = this.slotStore.spinResult
    // Stop принимается, пока идёт фаза: сигнал Stop и его подписку снимает scope
    const scope = new AbortController()
    const stopSignal = this.emitter.signalOn('ui:stopRequested', { signal: scope.signal })

    this.emitter.emit('spin:started')

    if (this.slotStore.isSpinHeld) {
      this.slotStore.startSeries()
    }

    // В серии строка выигрыша копит сумму всех спинов до её закрытия
    if (!this.slotStore.isTurboSeries) {
      this.slotStore.setWin(0)
    }

    this.slotStore.clearSpin()
    this.slotStore.chargeBet()
    this.reels.spin()

    try {
      let result: SpinResult

      try {
        result = await this.api.spin(bet, gameMode, signal)
      } catch (error) {
        // Отмена — не провал раунда: её разбирает движок, откатывать ставку остановленному автомату незачем
        if (signal.aborted) {
          throw error
        }

        // Отложенные выигрыши серии уже в серверном балансе прошлого спина: он закрывает и серию, и отказ
        if (this.slotStore.isTurboSeries && previousResult) {
          this.slotStore.settleRound(previousResult.balance)
        } else {
          this.slotStore.refundBet()
        }

        this.slotStore.endSeries()
        notifyError(error, 'Spin failed, the bet has been refunded')

        await this.reels.land(board, signal, stopSignal)

        return PhaseName.idle
      }

      this.slotStore.applySpin(result)

      await this.reels.land(this.slotStore.spinSymbols, signal, stopSignal)

      // Событие в прошедшем времени эмитится после посадки: подписчик (звук, аналитика) видит реально остановленные барабаны
      this.emitter.emit('spin:landed', result)

      return PhaseName.result
    } finally {
      scope.abort()
    }
  }
}
