import { inject, injectable } from 'inversify'
import { LiveContainer } from 'src/engine/live-container'
import { PANEL_ROW_WIDTH } from 'src/games/slot/constants'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { Checkbox } from 'src/games/slot/ui/hud/checkbox'

/** Чекбокс турбо-режима в настройках: галка следует за `slotStore.isTurboEnabled`, переключение доступно в idle. */
@injectable()
export class TurboCheckboxController extends LiveContainer {
  private readonly checkbox: Checkbox

  constructor(@inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore) {
    super()

    this.checkbox = new Checkbox({
      label: 'TURBO SPIN',
      width: PANEL_ROW_WIDTH,
      onTap: () => slotStore.toggleTurboEnabled(),
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
