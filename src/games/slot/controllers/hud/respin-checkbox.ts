import { inject, injectable } from 'inversify'
import type { GameEmitter } from 'src/core/events/game-emitter'
import { LiveContainer } from 'src/engine/live-container'
import { PANEL_ROW_WIDTH } from 'src/games/slot/constants'
import type { GameEvents } from 'src/games/slot/events'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { Checkbox } from 'src/games/slot/ui/hud/checkbox'

/** Чекбокс force respin в настройках. */
@injectable()
export class RespinCheckboxController extends LiveContainer {
  private readonly checkbox: Checkbox

  constructor(
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore,
    @inject(SLOT_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>
  ) {
    super()

    this.checkbox = new Checkbox({
      label: 'FORCE RESPIN',
      width: PANEL_ROW_WIDTH,
      onTap: () => {
        slotStore.toggleRespinForced()
        emitter.emit('ui:buttonTapped')
      },
    })

    this.addChild(this.checkbox)

    this.watch(
      () => slotStore.isRespinForced,
      (isRespinForced) => this.checkbox.setChecked(isRespinForced),
      { fireImmediately: true }
    )

    this.watch(
      () => slotStore.canToggleRespinForced,
      (enabled) => this.checkbox.setEnabled(enabled),
      { fireImmediately: true }
    )
  }
}
