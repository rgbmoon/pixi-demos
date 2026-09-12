import { inject, injectable } from 'inversify'
import type { GameEmitter } from 'src/core/events/game-emitter'
import type { Phase } from 'src/core/fsm/types'
import type { GameTicker } from 'src/engine/game-ticker'
import { ENGINE_TOKENS } from 'src/engine/tokens'
import { HOLD_WIN_INTRO_MS } from 'src/games/slot/constants'
import type { HoldWinController } from 'src/games/slot/controllers/reels/hold-win'
import type { ReelsMachineController } from 'src/games/slot/controllers/reels/reels-machine'
import type { GameEvents } from 'src/games/slot/events'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { PhaseName } from 'src/games/slot/types'

/**
 * Вход в бонус Hold & Win: начинает бонус в сторе и меняет доску барабанов на поле бонуса со
 * стартовыми монетами. Сети и ставки нет.
 */
@injectable()
export class HoldWinIntroPhase implements Phase<PhaseName> {
  readonly name = PhaseName.holdWinIntro

  private readonly emitter: GameEmitter<GameEvents>
  private readonly slotStore: SlotStore
  private readonly reels: ReelsMachineController
  private readonly holdWin: HoldWinController
  private readonly ticker: GameTicker

  constructor(
    @inject(SLOT_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore,
    @inject(SLOT_TOKENS.ReelsMachineController) reels: ReelsMachineController,
    @inject(SLOT_TOKENS.HoldWinController) holdWin: HoldWinController,
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker
  ) {
    this.emitter = emitter
    this.slotStore = slotStore
    this.reels = reels
    this.holdWin = holdWin
    this.ticker = ticker
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.holdWinSpin | typeof PhaseName.holdWinCollect> {
    // В бонус раунд переводит только result, когда бонус есть в ответе
    if (!this.slotStore.hasPendingHoldWin) {
      throw new Error('Hold & Win intro entered without a pending bonus')
    }

    this.slotStore.startHoldWin()
    this.emitter.emit('holdWin:started')

    await Promise.all([this.reels.hide(signal), this.holdWin.show(this.slotStore.holdWinFrame, signal)])

    if (!this.slotStore.isTurboEnabled) {
      await this.ticker.waitTicks(HOLD_WIN_INTRO_MS, signal)
    }

    return this.slotStore.nextHoldWinStep ? PhaseName.holdWinSpin : PhaseName.holdWinCollect
  }
}
