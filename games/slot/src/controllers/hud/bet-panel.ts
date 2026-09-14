import { inject, injectable } from 'inversify'

import { PANEL_BUTTON_GAP, PANEL_WIDTH } from '#src/constants'
import type { GameEvents } from '#src/events'
import type { SlotStore } from '#src/stores/slot'
import { SLOT_TOKENS } from '#src/tokens'
import { Panel } from '#src/ui/hud/panel'
import { formatAmount } from '#src/utils'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import { LiveContainer } from '@pixi-demos/engine/live-container'

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
