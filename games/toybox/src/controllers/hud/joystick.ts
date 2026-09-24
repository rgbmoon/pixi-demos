import { inject, injectable } from 'inversify'

import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { Joystick } from '#src/ui/hud/joystick'
import { LiveContainer } from '@pixi-demos/engine/live-container'

/**
 * Джойстик хода клешни: после мёртвой зоны задаёт движение с постоянной целевой скоростью.
 * При блокировке управления контроллер возвращает ручку в центр и обнуляет команду.
 */
@injectable()
export class JoystickController extends LiveContainer {
  private readonly joystick: Joystick

  constructor(@inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore) {
    super()

    this.joystick = new Joystick({ onMove: (vector) => toyboxStore.setJoystickDirection(vector) })

    this.addChild(this.joystick)

    this.watch(
      () => toyboxStore.canDrop,
      (enabled) => this.joystick.setEnabled(enabled),
      { fireImmediately: true }
    )
  }
}
