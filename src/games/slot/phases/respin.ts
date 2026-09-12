import { inject, injectable } from 'inversify'
import type { GameEmitter } from 'src/core/events/game-emitter'
import type { Phase } from 'src/core/fsm/types'
import type { GameTicker } from 'src/engine/game-ticker'
import { ENGINE_TOKENS } from 'src/engine/tokens'
import { RESPIN_INTRO_MS } from 'src/games/slot/constants'
import type { ReelsMachineController } from 'src/games/slot/controllers/reels/reels-machine'
import type { GameEvents } from 'src/games/slot/events'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { PhaseName } from 'src/games/slot/types'

/**
 * Фаза респина: переводит раунд на следующий шаг из ответа сервера, крутит барабаны без удержанных
 * и сажает их на кадр шага. Сети и ставки нет. Пока фаза идёт, нажатие Stop ускоряет посадку.
 */
@injectable()
export class RespinPhase implements Phase<PhaseName> {
  readonly name = PhaseName.respin

  private readonly emitter: GameEmitter<GameEvents>
  private readonly slotStore: SlotStore
  private readonly reels: ReelsMachineController
  private readonly ticker: GameTicker

  constructor(
    @inject(SLOT_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore,
    @inject(SLOT_TOKENS.ReelsMachineController) reels: ReelsMachineController,
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker
  ) {
    this.emitter = emitter
    this.slotStore = slotStore
    this.reels = reels
    this.ticker = ticker
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.result> {
    const step = this.slotStore.nextRespin

    // В респин раунд переводит только result, когда в ответе есть следующий шаг
    if (!step) {
      throw new Error('Respin phase entered without a respin step')
    }

    // Stop принимается, пока идёт фаза: сигнал Stop и его подписку снимает scope
    const scope = new AbortController()
    const stopSignal = this.emitter.signalOn('ui:stopRequested', { signal: scope.signal })

    // Шаг переключается до старта: подсветка удержанных барабанов появляется раньше прокрутки
    this.slotStore.advanceRoundStep()

    try {
      if (!this.slotStore.isTurboEnabled) {
        await this.ticker.waitTicks(RESPIN_INTRO_MS, signal)
      }

      this.emitter.emit('respin:started', { held: step.held })
      this.reels.spin(step.held)

      await this.reels.land(this.slotStore.stepSymbols, [], signal, stopSignal)

      this.emitter.emit('respin:landed', step)

      return PhaseName.result
    } finally {
      scope.abort()
    }
  }
}
