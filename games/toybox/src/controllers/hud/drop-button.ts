import { inject, injectable } from 'inversify'
import { Sprite } from 'pixi.js'

import { HUD_SEQUENCES } from '#src/assets'
import { ART_PIXEL, TOUR_DROP_HINT_LIFT } from '#src/constants'
import type { GameEvents } from '#src/events'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { DropButton } from '#src/ui/hud/drop-button'
import { TourHint } from '#src/ui/hud/tour-hint'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/** Кнопка опускания клешни: объявляет намерение игрока, цикл ведёт автомат. Над кнопкой — стрелка тура. */
@injectable()
export class DropButtonController extends LiveContainer {
  private readonly button: DropButton
  private readonly hint: TourHint

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore,
    @inject(TOYBOX_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>
  ) {
    super()

    this.button = new DropButton({
      label: 'Drop the claw',
      onTap: () => {
        toyboxStore.completeTour()
        emitter.emit('ui:dropRequested')
      },
    })

    const arrow = new Sprite()

    arrow.scale.set(ART_PIXEL)
    this.hint = new TourHint(ticker, arrow, HUD_SEQUENCES.tourDrop)
    this.hint.position.set(0, -TOUR_DROP_HINT_LIFT * ART_PIXEL)

    this.addChild(this.button, this.hint)

    this.watch(
      () => toyboxStore.canDrop,
      (enabled) => this.button.setEnabled(enabled),
      { fireImmediately: true }
    )
    this.watch(
      () => toyboxStore.isTourShown,
      (shown) => this.hint.setShown(shown),
      { fireImmediately: true }
    )
  }
}
