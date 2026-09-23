import type { ToyboxStore } from '#src/stores/toybox'
import { Joystick } from '#src/ui/hud/joystick'
import { LiveContainer } from '@pixi-demos/engine/live-container'

/**
 * Джойстик хода клешни: после мёртвой зоны задаёт движение с постоянной целевой скоростью.
 * При блокировке управления контроллер возвращает ручку в центр и обнуляет команду.
 */
export class JoystickController extends LiveContainer {
  private readonly joystick: Joystick

  constructor(toyboxStore: ToyboxStore) {
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
