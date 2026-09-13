import type { GameEmitter } from 'src/core/events/game-emitter'
import { LiveContainer } from 'src/engine/live-container'
import { PANEL_BUTTON_GAP, PANEL_WIDTH } from 'src/games/slot/constants'
import type { GameEvents } from 'src/games/slot/events'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { Panel } from 'src/games/slot/ui/hud/panel'

import { GameModeMinusButtonController } from './game-mode-minus-button'
import { GameModePlusButtonController } from './game-mode-plus-button'


/**
 * Панель режима игры: показывает число линий, участвующих в раунде,
 * и расставляет вокруг плашки кнопки шага по режимам.
 */
export class GameModePanelController extends LiveContainer {
  private readonly panel = new Panel('LINES')

  constructor(slotStore: SlotStore, emitter: GameEmitter<GameEvents>) {
    super()

    const minusButton = new GameModeMinusButtonController(slotStore, emitter)
    const plusButton = new GameModePlusButtonController(slotStore, emitter)

    minusButton.position.set(-(PANEL_WIDTH / 2 + PANEL_BUTTON_GAP + minusButton.sizeUnits), -minusButton.sizeUnits / 2)
    plusButton.position.set(PANEL_WIDTH / 2 + PANEL_BUTTON_GAP, -plusButton.sizeUnits / 2)

    this.addChild(this.panel, minusButton, plusButton)

    this.watch(
      () => slotStore.lines,
      (lines) => this.panel.setValue(String(lines)),
      { fireImmediately: true }
    )
  }
}
