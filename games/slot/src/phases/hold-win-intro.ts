import { inject, injectable } from 'inversify'

import { HOLD_WIN_INTRO_MS } from '#src/constants'
import type { HoldWinMachineController } from '#src/controllers/reels/hold-win-machine'
import type { ReelsMachineController } from '#src/controllers/reels/reels-machine'
import type { GameEvents } from '#src/events'
import type { SlotStore } from '#src/stores/slot'
import { SLOT_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { Phase } from '@pixi-demos/core/fsm/types'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/**
 * Вход в бонус Hold & Win: начинает бонус в сторе и меняет доску барабанов на поле бонуса со
 * стартовыми монетами. Сети и ставки нет.
 */
@injectable()
export class HoldWinIntroPhase implements Phase<PhaseName> {
  readonly name = PhaseName.holdWinIntro

  private readonly emitter: GameEmitter<GameEvents>
  private readonly slotStore: SlotStore
  private readonly reelsMachine: ReelsMachineController
  private readonly holdWinMachine: HoldWinMachineController
  private readonly ticker: GameTicker

  constructor(
    @inject(SLOT_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore,
    @inject(SLOT_TOKENS.ReelsMachineController) reelsMachine: ReelsMachineController,
    @inject(SLOT_TOKENS.HoldWinMachineController) holdWinMachine: HoldWinMachineController,
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker
  ) {
    this.emitter = emitter
    this.slotStore = slotStore
    this.reelsMachine = reelsMachine
    this.holdWinMachine = holdWinMachine
    this.ticker = ticker
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.holdWinSpin | typeof PhaseName.holdWinCollect> {
    // В бонус раунд переводит только result, когда бонус есть в ответе
    if (!this.slotStore.hasPendingHoldWin) {
      throw new Error('Hold & Win intro entered without a pending bonus')
    }

    this.slotStore.startHoldWin()
    this.emitter.emit('holdWin:started')

    await Promise.all([
      this.reelsMachine.hide(signal),
      this.holdWinMachine.show(this.slotStore.holdWinFrame, signal),
    ])

    if (!this.slotStore.isTurboEnabled) {
      await this.ticker.waitTicks(HOLD_WIN_INTRO_MS, signal)
    }

    return this.slotStore.nextHoldWinStep ? PhaseName.holdWinSpin : PhaseName.holdWinCollect
  }
}
