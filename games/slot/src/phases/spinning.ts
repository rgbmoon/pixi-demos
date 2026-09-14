import { inject, injectable } from 'inversify'

import type { SlotApi, SpinResult } from '#src/api/slot'
import type { ReelsMachineController } from '#src/controllers/reels/reels-machine'
import type { GameEvents } from '#src/events'
import type { SlotStore } from '#src/stores/slot'
import { SLOT_TOKENS } from '#src/tokens'
import { ForcedMechanic, PhaseName } from '#src/types'
import { notifyError } from '@pixi-demos/core/errors/utils'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { Phase } from '@pixi-demos/core/fsm/types'

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
  private readonly reelsMachine: ReelsMachineController

  constructor(
    @inject(SLOT_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore,
    @inject(SLOT_TOKENS.SlotApi) api: SlotApi,
    @inject(SLOT_TOKENS.ReelsMachineController) reelsMachine: ReelsMachineController
  ) {
    this.emitter = emitter
    this.slotStore = slotStore
    this.api = api
    this.reelsMachine = reelsMachine
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.idle | typeof PhaseName.result> {
    const { bet, gameMode, forcedMechanic } = this.slotStore
    // Доска до спина — кадр последнего шага прошлого раунда: на неё барабаны вернутся, если сервер не ответит
    const board = this.slotStore.stepSymbols ?? this.slotStore.initialSymbols
    // Прошлый ответ сервера: его балансом закрывается серия, если спин провалится
    const previousResult = this.slotStore.spinResult
    // Stop принимается, пока идёт фаза и Stop доступен по стору: подписку снимает scope
    const scope = new AbortController()

    this.emitter.on(
      'ui:stopRequested',
      () => {
        if (this.slotStore.canStop) this.reelsMachine.slam()
      },
      { signal: scope.signal }
    )

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
    this.reelsMachine.spin()

    try {
      let result: SpinResult

      try {
        result = await this.api.spin(
          {
            bet,
            gameMode,
            forceAnticipation: forcedMechanic === ForcedMechanic.anticipation,
            forceRespin: forcedMechanic === ForcedMechanic.respin,
            forceHoldWin: forcedMechanic === ForcedMechanic.holdWin,
            forceCascade: forcedMechanic === ForcedMechanic.cascade,
          },
          signal
        )
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

        await this.reelsMachine.land(board, [], signal)

        return PhaseName.idle
      }

      this.slotStore.applySpin(result)

      await this.reelsMachine.land(this.slotStore.spinSymbols, this.slotStore.presentedAnticipation, signal)

      // Событие в прошедшем времени эмитится после посадки: подписчик (звук, аналитика) видит реально остановленные барабаны
      this.emitter.emit('spin:landed', result)

      return PhaseName.result
    } finally {
      scope.abort()
    }
  }
}
