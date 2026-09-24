import { inject, injectable } from 'inversify'

import { RESET_BUTTON_LABEL } from '#src/constants'
import type { GameEvents } from '#src/events'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { ResetButton } from '#src/ui/hud/reset-button'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import { LiveContainer } from '@pixi-demos/engine/live-container'

/** Кнопка сброса кучи: доступна только в покое, наверх сообщает о запросе событием. */
@injectable()
export class ResetButtonController extends LiveContainer {
  private readonly button: ResetButton

  constructor(
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore,
    @inject(TOYBOX_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>
  ) {
    super()

    this.button = new ResetButton({
      label: RESET_BUTTON_LABEL,
      onTap: () => emitter.emit('ui:resetRequested'),
    })

    this.addChild(this.button)

    this.watch(
      () => toyboxStore.canReset,
      (enabled) => this.button.setEnabled(enabled),
      { fireImmediately: true }
    )
  }
}
