import type { GameEmitter } from 'src/core/events/game-emitter'
import { LiveContainer } from 'src/engine/live-container'
import { PANEL_ROW_WIDTH } from 'src/games/slot/constants'
import type { GameEvents } from 'src/games/slot/events'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { CheckboxVariant, ForcedMechanic } from 'src/games/slot/types'
import { Checkbox } from 'src/games/slot/ui/hud/checkbox'

/** Чекбокс force Hold & Win в настройках. */
export class HoldWinCheckboxController extends LiveContainer {
  private readonly checkbox: Checkbox

  constructor(slotStore: SlotStore, emitter: GameEmitter<GameEvents>) {
    super()

    this.checkbox = new Checkbox({
      label: 'HOLD & WIN',
      width: PANEL_ROW_WIDTH,
      variant: CheckboxVariant.radio,
      onTap: () => {
        slotStore.toggleForcedMechanic(ForcedMechanic.holdWin)
        emitter.emit('ui:buttonTapped')
      },
    })

    this.addChild(this.checkbox)

    this.watch(
      () => slotStore.forcedMechanic === ForcedMechanic.holdWin,
      (isChecked) => this.checkbox.setChecked(isChecked),
      { fireImmediately: true }
    )

    this.watch(
      () => slotStore.canToggleForcedMechanic(ForcedMechanic.holdWin),
      (enabled) => this.checkbox.setEnabled(enabled),
      { fireImmediately: true }
    )
  }
}
