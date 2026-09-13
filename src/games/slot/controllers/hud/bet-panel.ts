import { inject, injectable } from 'inversify'
import type { GameEmitter } from 'src/core/events/game-emitter'
import { LiveContainer } from 'src/engine/live-container'
import { PANEL_BUTTON_GAP, PANEL_WIDTH } from 'src/games/slot/constants'
import type { GameEvents } from 'src/games/slot/events'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { Panel } from 'src/games/slot/ui/hud/panel'
import { formatAmount } from 'src/games/slot/utils'

import { BetMinusButtonController } from './bet-minus-button'
import { BetPlusButtonController } from './bet-plus-button'


/**
 * Панель ставки: ведёт значение плашки за `slotStore.bet` и расставляет вокруг неё кнопки шага.
 */
@injectable()
export class BetPanelController extends LiveContainer {
  private readonly panel = new Panel('BET')

  constructor(
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore,
    @inject(SLOT_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>
  ) {
    super()

    const minusButton = new BetMinusButtonController(slotStore, emitter)
    const plusButton = new BetPlusButtonController(slotStore, emitter)

    minusButton.position.set(-(PANEL_WIDTH / 2 + PANEL_BUTTON_GAP + minusButton.sizeUnits), -minusButton.sizeUnits / 2)
    plusButton.position.set(PANEL_WIDTH / 2 + PANEL_BUTTON_GAP, -plusButton.sizeUnits / 2)

    this.addChild(this.panel, minusButton, plusButton)

    this.watch(
      () => slotStore.bet,
      (bet) => this.panel.setValue(formatAmount(bet)),
      { fireImmediately: true }
    )
  }
}
