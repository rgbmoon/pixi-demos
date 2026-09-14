import { inject, injectable } from 'inversify'
import type { GameEmitter } from 'src/core/events/game-emitter'
import type { Phase } from 'src/core/fsm/types'
import type { GameTicker } from 'src/engine/game-ticker'
import { ENGINE_TOKENS } from 'src/engine/tokens'
import { HOLD_WIN_STEP_MS } from 'src/games/slot/constants'
import type { HoldWinMachineController } from 'src/games/slot/controllers/reels/hold-win-machine'
import type { GameEvents } from 'src/games/slot/events'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { PhaseName } from 'src/games/slot/types'

/**
 * Шаг бонуса Hold & Win: крутит незанятые ячейки и сажает их на поле следующего шага из ответа.
 * Пока в ответе есть шаги, возвращает раунд в себя же. Пока фаза идёт, нажатие Stop ускоряет посадку.
 */
@injectable()
export class HoldWinSpinPhase implements Phase<PhaseName> {
  readonly name = PhaseName.holdWinSpin

  private readonly emitter: GameEmitter<GameEvents>
  private readonly slotStore: SlotStore
  private readonly holdWinMachine: HoldWinMachineController
  private readonly ticker: GameTicker

  constructor(
    @inject(SLOT_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore,
    @inject(SLOT_TOKENS.HoldWinMachineController) holdWinMachine: HoldWinMachineController,
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker
  ) {
    this.emitter = emitter
    this.slotStore = slotStore
    this.holdWinMachine = holdWinMachine
    this.ticker = ticker
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.holdWinSpin | typeof PhaseName.holdWinCollect> {
    const step = this.slotStore.nextHoldWinStep

    // В шаг раунд переводят только вход в бонус и прошлый шаг, когда в ответе есть следующий
    if (!step) {
      throw new Error('Hold & Win spin phase entered without a step')
    }

    // Stop принимается, пока идёт фаза и Stop доступен по стору: подписку снимает scope
    const scope = new AbortController()

    this.emitter.on(
      'ui:stopRequested',
      () => {
        if (this.slotStore.canStop) this.holdWinMachine.slam()
      },
      { signal: scope.signal }
    )

    try {
      if (!this.slotStore.isTurboEnabled) {
        await this.ticker.waitTicks(HOLD_WIN_STEP_MS, signal)
      }

      this.emitter.emit('holdWin:spinStarted', { held: step.held })
      this.holdWinMachine.spin(step.held)

      await this.holdWinMachine.land(step.frame, signal)

      // Шаг засчитывается после посадки: счётчик респинов меняется, когда ячейки встали
      this.slotStore.advanceHoldWinStep()
      this.emitter.emit('holdWin:landed', step)

      return this.slotStore.nextHoldWinStep ? PhaseName.holdWinSpin : PhaseName.holdWinCollect
    } finally {
      scope.abort()
    }
  }
}
