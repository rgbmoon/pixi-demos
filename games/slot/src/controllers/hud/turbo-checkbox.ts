import { PANEL_ROW_WIDTH } from '#src/constants'
import type { GameEvents } from '#src/events'
import type { SlotStore } from '#src/stores/slot'
import { Checkbox } from '#src/ui/hud/checkbox'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import { LiveContainer } from '@pixi-demos/engine/live-container'

/** Чекбокс турбо-режима в настройках: галка следует за `slotStore.isTurboEnabled`, переключение доступно в idle. */
export class TurboCheckboxController extends LiveContainer {
  private readonly checkbox: Checkbox

  constructor(slotStore: SlotStore, emitter: GameEmitter<GameEvents>) {
    super()

    this.checkbox = new Checkbox({
      label: 'TURBO SPIN',
      width: PANEL_ROW_WIDTH,
      onTap: () => {
        slotStore.toggleTurboEnabled()
        emitter.emit('ui:buttonTapped')
      },
    })

    this.addChild(this.checkbox)

    this.watch(
      () => slotStore.isTurboEnabled,
      (isTurboEnabled) => this.checkbox.setChecked(isTurboEnabled),
      { fireImmediately: true }
    )

    this.watch(
      () => slotStore.canToggleTurbo,
      (enabled) => this.checkbox.setEnabled(enabled),
      { fireImmediately: true }
    )
  }
}
