import type { ToyboxStore } from '#src/stores/toybox'
import { Joystick } from '#src/ui/hud/joystick'
import { LiveContainer } from '@pixi-demos/engine/live-container'

import type { ClawController } from '../box/claw'

/**
 * Джойстик хода клешни: отклонение ручки уходит прямо в контроллер клешни.
 * Вне покоя джойстик гаснет и отпускает ручку — выключенный узел уже не услышит отпускание сам.
 */
export class JoystickController extends LiveContainer {
  private readonly joystick: Joystick

  constructor(claw: ClawController, toyboxStore: ToyboxStore) {
    super()

    this.joystick = new Joystick({ onMove: (vector) => claw.setDirection(vector) })

    this.addChild(this.joystick)

    this.watch(
      () => toyboxStore.isIdle,
      (enabled) => this.joystick.setEnabled(enabled),
      { fireImmediately: true }
    )
  }

  /** Радиус подложки в дизайн-единицах: по нему сцена считает габариты блока управления. */
  get radiusUnits(): number {
    return this.joystick.radiusUnits
  }
}
