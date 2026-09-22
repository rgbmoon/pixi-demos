import { DROP_BUTTON_CENTER, JOYSTICK_CENTER } from '#src/constants'
import type { GameEvents } from '#src/events'
import type { ToyboxStore } from '#src/stores/toybox'
import { worldToScreen } from '#src/utils/projection'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import { LiveContainer } from '@pixi-demos/engine/live-container'

import type { ClawController } from '../box/claw'

import { DropButtonController } from './drop-button'
import { JoystickController } from './joystick'

// TODO явно лишний контроллер
/** Блок управления, элементы которого стоят в мировых точках наклонной панели. */
export class ControlsController extends LiveContainer {
  constructor(claw: ClawController, toyboxStore: ToyboxStore, emitter: GameEmitter<GameEvents>) {
    super()

    const joystick = new JoystickController(claw, toyboxStore)
    const dropButton = new DropButtonController(toyboxStore, emitter)
    const joystickCenter = worldToScreen(JOYSTICK_CENTER)
    const dropCenter = worldToScreen(DROP_BUTTON_CENTER)

    joystick.position.set(joystickCenter.x, joystickCenter.y)
    dropButton.position.set(dropCenter.x, dropCenter.y)

    this.addChild(joystick, dropButton)
  }
}
