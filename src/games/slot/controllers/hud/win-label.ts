import { inject, injectable } from 'inversify'
import { LiveContainer } from 'src/engine/live-container'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { LabelColor, PhaseName } from 'src/games/slot/types'
import { ValueLabel } from 'src/games/slot/ui/hud/value-label'
import { formatAmount } from 'src/games/slot/utils'

const WIN_CAPTION = 'WIN'
const IDLE_MESSAGE = 'MAKE YOUR BET'
const SPIN_MESSAGE = 'GOOD LUCK'
const TURBO_IDLE_MESSAGE = 'HOLD FOR SPIN'
const TURBO_SPIN_MESSAGE = 'TURBO!'
const RESPINS_CAPTION = 'RESPINS'

/**
 * Строка под барабанами: сумма выигрыша (в турбо-серии — накопленная), а между раундами — подсказка
 * по фазе. В турбо-режиме подсказки свои: в покое зовёт зажать спин, во вращении объявляет турбо;
 * подпись суммы красная.
 * Пока идёт бонус Hold & Win, строка показывает счётчик его респинов.
 */
@injectable()
export class WinLabelController extends LiveContainer {
  private readonly slotStore: SlotStore
  private readonly valueLabel = new ValueLabel()

  constructor(@inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore) {
    super()

    this.slotStore = slotStore

    this.addChild(this.valueLabel)

    // Подписки за данными на один render: содержимое строки зависит от суммы, фазы и режима
    this.watch(
      () => slotStore.win,
      () => this.render(),
      { fireImmediately: true }
    )
    this.watch(
      () => slotStore.phase,
      () => this.render()
    )
    this.watch(
      () => slotStore.isTurboEnabled,
      () => this.render()
    )
    this.watch(
      () => slotStore.isHoldWinActive && slotStore.holdWinRespinsLeft,
      () => this.render()
    )
  }

  private render(): void {
    const { win, isTurboEnabled, isHoldWinActive, holdWinRespinsLeft } = this.slotStore

    if (isHoldWinActive) {
      this.valueLabel.setText(RESPINS_CAPTION, String(holdWinRespinsLeft))

      return
    }

    if (win > 0) {
      // В турбо подпись красная, как объявление TURBO! и множитель каскада
      this.valueLabel.setText(
        WIN_CAPTION,
        formatAmount(win),
        LabelColor.white,
        isTurboEnabled ? LabelColor.red : LabelColor.cyan
      )

      return
    }

    const isIdle = this.slotStore.phase === PhaseName.idle

    if (!isTurboEnabled) {
      this.valueLabel.setText('', isIdle ? IDLE_MESSAGE : SPIN_MESSAGE)

      return
    }

    if (isIdle) {
      this.valueLabel.setText('', TURBO_IDLE_MESSAGE, LabelColor.cyan)

      return
    }

    this.valueLabel.setText('', TURBO_SPIN_MESSAGE, LabelColor.red)
  }
}
