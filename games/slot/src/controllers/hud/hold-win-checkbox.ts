import { PANEL_ROW_WIDTH } from '#src/constants'
import type { GameEvents } from '#src/events'
import type { SlotStore } from '#src/stores/slot'
import { CheckboxVariant, ForcedMechanic } from '#src/types'
import { Checkbox } from '#src/ui/hud/checkbox'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import { LiveContainer } from '@pixi-demos/engine/live-container'

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
