import { inject, injectable } from 'inversify'
import { LiveContainer } from 'src/engine/live-container'
import { PANEL_WIDTH } from 'src/games/slot/constants'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { Panel } from 'src/games/slot/ui/hud/panel'
import { formatAmount } from 'src/games/slot/utils'

import type { BetMinusButtonController } from './bet-minus-button'
import type { BetPlusButtonController } from './bet-plus-button'

const BUTTON_GAP = 16

/**
 * Панель ставки: ведёт значение плашки за `slotStore.bet` и расставляет вокруг неё кнопки шага.
 */
@injectable()
export class BetPanelController extends LiveContainer {
  private readonly panel = new Panel('BET')

  constructor(
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore,
    @inject(SLOT_TOKENS.BetMinusButtonController) minusButton: BetMinusButtonController,
    @inject(SLOT_TOKENS.BetPlusButtonController) plusButton: BetPlusButtonController
  ) {
    super()

    minusButton.position.set(-(PANEL_WIDTH / 2 + BUTTON_GAP + minusButton.sizeUnits), -minusButton.sizeUnits / 2)
    plusButton.position.set(PANEL_WIDTH / 2 + BUTTON_GAP, -plusButton.sizeUnits / 2)

    this.addChild(this.panel, minusButton, plusButton)

    this.watch(
      () => slotStore.bet,
      (bet) => this.panel.setValue(formatAmount(bet)),
      { fireImmediately: true }
    )
  }
}
