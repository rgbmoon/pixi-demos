import { inject, injectable } from 'inversify'
import type { GameEmitter } from 'src/core/events/game-emitter'
import type { Phase } from 'src/core/fsm/types'
import type { GameTicker } from 'src/engine/game-ticker'
import { ENGINE_TOKENS } from 'src/engine/tokens'
import type { ReelsMachineController } from 'src/games/slot/controllers/reels/reels-machine'
import type { GameEvents } from 'src/games/slot/events'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { PhaseName } from 'src/games/slot/types'

import { WIN_DISPLAY_MS } from '../constants'


/** Фаза показа результата: приземляет барабаны на серверные символы и объявляет `spin:landed`. */
@injectable()
export class ResultPhase implements Phase<PhaseName> {
  readonly name = PhaseName.result

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

  async enter(signal: AbortSignal): Promise<typeof PhaseName.idle> {
    const { spinResult: result } = this.slotStore

    if (!result) {
      return PhaseName.idle
    }

    await this.reels.land(this.slotStore.spinSymbols, signal)

    // Событие в прошедшем времени эмитится после посадки: подписчик (звук, аналитика) видит реально остановленные барабаны
    this.emitter.emit('spin:landed', result)

    // Сумма встаёт в WinLabelController до анимаций линий и висит там, пока раунд не закроется
    this.slotStore.setWin(this.slotStore.spinWin)

    if (this.slotStore.spinPaylines.length > 0) {
      await this.reels.showAllWins(signal)
      await this.reels.showTint(signal)
      await this.reels.playWinLines(signal)
      await this.reels.hideTint(signal)
      await this.ticker.waitTicks(WIN_DISPLAY_MS, signal)
    }

    this.slotStore.settleRound(result.balance)

    return PhaseName.idle
  }
}
