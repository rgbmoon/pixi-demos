import { inject, injectable } from 'inversify'
import { LiveContainer } from 'src/engine/live-container'
import { PANEL_WIDTH } from 'src/games/slot/constants'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { Panel } from 'src/games/slot/ui/hud/panel'

import type { GameModeMinusButtonController } from './game-mode-minus-button'
import type { GameModePlusButtonController } from './game-mode-plus-button'

const BUTTON_GAP = 16

/**
 * Панель режима игры: показывает число линий, участвующих в раунде,
 * и расставляет вокруг плашки кнопки шага по режимам.
 */
@injectable()
export class GameModePanelController extends LiveContainer {
  private readonly panel = new Panel('LINES')

  constructor(
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore,
    @inject(SLOT_TOKENS.GameModeMinusButtonController) minusButton: GameModeMinusButtonController,
    @inject(SLOT_TOKENS.GameModePlusButtonController) plusButton: GameModePlusButtonController
  ) {
    super()

    minusButton.position.set(-(PANEL_WIDTH / 2 + BUTTON_GAP + minusButton.sizeUnits), -minusButton.sizeUnits / 2)
    plusButton.position.set(PANEL_WIDTH / 2 + BUTTON_GAP, -plusButton.sizeUnits / 2)

    this.addChild(this.panel, minusButton, plusButton)

    this.watch(
      () => slotStore.lines,
      (lines) => this.panel.setValue(String(lines)),
      { fireImmediately: true }
    )
  }
}
