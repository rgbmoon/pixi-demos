import { inject, injectable } from 'inversify'
import type { Phase } from 'src/core/fsm/types'
import type { GameTicker } from 'src/engine/game-ticker'
import { ENGINE_TOKENS } from 'src/engine/tokens'
import type { BackgroundController } from 'src/games/slot/controllers/background'
import type { ReelsMachineController } from 'src/games/slot/controllers/reels/reels-machine'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { PhaseName } from 'src/games/slot/types'

import { TURBO_WIN_SHOWCASE_MS, WIN_DISPLAY_MS } from '../constants'


/**
 * Фаза показа результата: барабаны уже стоят, фаза выставляет выигрыш, показывает линии и закрывает раунд.
 * В турбо-серии возвращает раунд в `spinning`, пока спин зажат и хватает на ставку.
 */
@injectable()
export class ResultPhase implements Phase<PhaseName> {
  readonly name = PhaseName.result

  private readonly slotStore: SlotStore
  private readonly reels: ReelsMachineController
  private readonly background: BackgroundController
  private readonly ticker: GameTicker

  constructor(
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore,
    @inject(SLOT_TOKENS.ReelsMachineController) reels: ReelsMachineController,
    @inject(SLOT_TOKENS.BackgroundController) background: BackgroundController,
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker
  ) {
    this.slotStore = slotStore
    this.reels = reels
    this.background = background
    this.ticker = ticker
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.idle | typeof PhaseName.spinning> {
    const { spinResult: result } = this.slotStore

    if (!result) {
      return PhaseName.idle
    }

    // Сумма встаёт в WinLabelController до анимаций линий и висит там, пока раунд не закроется; в серии она копится
    if (this.slotStore.isTurboSeries) {
      this.slotStore.accrueWin(this.slotStore.spinWin)
    } else {
      this.slotStore.setWin(this.slotStore.spinWin)
    }

    if (this.slotStore.spinPaylines.length > 0) {
      await this.presentWin(signal)
    }

    if (!this.slotStore.isTurboSeries) {
      this.slotStore.settleRound(result.balance)

      return PhaseName.idle
    }

    // Серия идёт, пока спин зажат и хватает на ставку; выигрыши тем временем ждут в строке WIN
    if (this.canContinueSeries()) {
      return PhaseName.spinning
    }

    this.slotStore.settleRound(result.balance)

    // Зачисленные выигрыши могли снова покрыть ставку: зажатая кнопка продолжает серию
    if (this.canContinueSeries()) {
      return PhaseName.spinning
    }

    this.slotStore.endSeries()

    return PhaseName.idle
  }

  /**
   * Показ выигрыша: в турбо-режиме — одна короткая вспышка всех линий, иначе полный разбор по линиям.
   * Выигрыш после anticipation открывается вспышкой фона вместе с показом всех линий.
   */
  private async presentWin(signal: AbortSignal): Promise<void> {
    if (this.slotStore.isTurboEnabled) {
      await this.reels.showAllWins(signal, TURBO_WIN_SHOWCASE_MS)

      return
    }

    if (this.slotStore.isAnticipationWin) {
      await Promise.all([this.background.flash(signal), this.reels.showAllWins(signal)])
    } else {
      await this.reels.showAllWins(signal)
    }
    await this.reels.showTint(signal)
    await this.reels.playWinLines(signal)
    await this.reels.hideTint(signal)
    await this.ticker.waitTicks(WIN_DISPLAY_MS, signal)
  }

  private canContinueSeries(): boolean {
    return this.slotStore.isSpinHeld && this.slotStore.canAffordBet
  }
}
