import { inject, injectable } from 'inversify'
import { Sprite } from 'pixi.js'

import { HUD_SEQUENCES } from '#src/assets'
import { ART_PIXEL } from '#src/constants'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { Joystick } from '#src/ui/hud/joystick'
import { TourHint } from '#src/ui/hud/tour-hint'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/**
 * Джойстик хода клешни: после мёртвой зоны задаёт движение с постоянной целевой скоростью.
 * При блокировке управления контроллер возвращает ручку в центр и обнуляет команду. Вокруг шара — стрелки тура.
 */
@injectable()
export class JoystickController extends LiveContainer {
  private readonly joystick: Joystick
  private readonly hint: TourHint

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore
  ) {
    super()

    this.joystick = new Joystick({
      onMove: (vector) => {
        toyboxStore.completeTour()
        toyboxStore.setJoystickDirection(vector)
      },
    })
    const arrows = new Sprite()

    arrows.scale.set(ART_PIXEL)
    this.hint = new TourHint(ticker, arrows, HUD_SEQUENCES.tourJoystick)

    this.addChild(this.joystick, this.hint)

    this.watch(
      () => toyboxStore.canDrop,
      (enabled) => this.joystick.setEnabled(enabled),
      { fireImmediately: true }
    )
    this.watch(
      () => toyboxStore.isTourShown,
      (shown) => this.hint.setShown(shown),
      { fireImmediately: true }
    )
  }
}
