import { inject, injectable } from 'inversify'

import type { BackgroundController } from '#src/controllers/background'
import type { ReelsMachineController } from '#src/controllers/reels/reels-machine'
import type { SlotStore } from '#src/stores/slot'
import { SLOT_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { Phase } from '@pixi-demos/core/fsm/types'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

import { TURBO_WIN_SHOWCASE_MS, WIN_DISPLAY_MS } from '../constants'

/**
 * Фаза показа результата: барабаны уже стоят, фаза выставляет выигрыш шага, показывает линии и закрывает раунд.
 * Пока в ответе есть следующий шаг каскада, коротко показывает выигрыш и возвращает раунд в `cascade`;
 * пока есть шаг респина — в `respin`, после них — в бонус Hold & Win.
 * В турбо-серии возвращает раунд в `spinning`, пока спин зажат и хватает на ставку.
 */
@injectable()
export class ResultPhase implements Phase<PhaseName> {
  readonly name = PhaseName.result

  private readonly slotStore: SlotStore
  private readonly reelsMachine: ReelsMachineController
  private readonly background: BackgroundController
  private readonly ticker: GameTicker

  constructor(
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore,
    @inject(SLOT_TOKENS.ReelsMachineController) reelsMachine: ReelsMachineController,
    @inject(SLOT_TOKENS.BackgroundController) background: BackgroundController,
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker
  ) {
    this.slotStore = slotStore
    this.reelsMachine = reelsMachine
    this.background = background
    this.ticker = ticker
  }

  async enter(
    signal: AbortSignal
  ): Promise<
    | typeof PhaseName.idle
    | typeof PhaseName.spinning
    | typeof PhaseName.respin
    | typeof PhaseName.holdWinIntro
    | typeof PhaseName.cascade
  > {
    const { spinResult: result } = this.slotStore

    if (!result) {
      return PhaseName.idle
    }

    // Сумма встаёт в WinLabelController до анимаций линий и висит там, пока раунд не закроется;
    // шаги респина и каскада, бонус и спины серии её копят
    if (
      this.slotStore.isTurboSeries ||
      this.slotStore.currentRespin ||
      this.slotStore.currentCascade ||
      this.slotStore.isHoldWinCollected
    ) {
      this.slotStore.accrueWin(this.slotStore.stepWin)
    } else {
      this.slotStore.setWin(this.slotStore.stepWin)
    }

    // Сумму без линий держат собранный бонус со своим выигрышем и цепочка каскадов с выигрышем по ходу
    const holdsSummary = this.slotStore.isHoldWinCollected
      ? this.slotStore.stepWin > 0
      : this.slotStore.currentCascade !== undefined && this.slotStore.win > 0

    if (this.slotStore.stepPaylines.length > 0) {
      await (this.slotStore.nextCascade ? this.presentCascadeWin(signal) : this.presentWin(signal))
    } else if (holdsSummary && !this.slotStore.isTurboEnabled) {
      // Линий у бонуса и у последнего шага каскада нет: сумма раунда стоит в строке WIN, пока не уйдёт
      // в кредит; турбо выдержек не держит
      await this.ticker.waitTicks(WIN_DISPLAY_MS, signal)
    }

    // Баланс ответа включает все шаги: раунд закрывается только после последнего
    if (this.slotStore.nextCascade) {
      return PhaseName.cascade
    }

    if (this.slotStore.nextRespin) {
      return PhaseName.respin
    }

    if (this.slotStore.hasPendingHoldWin) {
      return PhaseName.holdWinIntro
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
      await this.reelsMachine.showAllWins(signal, TURBO_WIN_SHOWCASE_MS)

      return
    }

    if (this.slotStore.isAnticipationWin) {
      await Promise.all([this.background.flash(signal), this.reelsMachine.showAllWins(signal)])
    } else {
      await this.reelsMachine.showAllWins(signal)
    }
    await this.reelsMachine.showTint(signal)
    await this.reelsMachine.playWinLines(signal)
    await this.reelsMachine.hideTint(signal)
    await this.ticker.waitTicks(WIN_DISPLAY_MS, signal)
  }

  /**
   * Показ выигрыша перед каскадом: только все линии разом, в турбо — короткая вспышка. Выигравшие символы
   * следом взрываются, разбор по линиям их бы задержал. Выигрыш после anticipation открывается вспышкой фона.
   */
  private async presentCascadeWin(signal: AbortSignal): Promise<void> {
    const durationMs = this.slotStore.isTurboEnabled ? TURBO_WIN_SHOWCASE_MS : undefined

    if (this.slotStore.isAnticipationWin) {
      await Promise.all([this.background.flash(signal), this.reelsMachine.showAllWins(signal, durationMs)])
    } else {
      await this.reelsMachine.showAllWins(signal, durationMs)
    }
  }

  private canContinueSeries(): boolean {
    return this.slotStore.isSpinHeld && this.slotStore.canAffordBet
  }
}
