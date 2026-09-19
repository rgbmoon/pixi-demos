import { DROP_OFFSET_X, JOYSTICK_OFFSET_X } from '#src/constants'
import type { GameEvents } from '#src/events'
import type { ToyboxStore } from '#src/stores/toybox'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import { LiveContainer } from '@pixi-demos/engine/live-container'

import type { ClawController } from '../box/claw'

import { DropButtonController } from './drop-button'
import { JoystickController } from './joystick'

/** Блок управления: джойстик хода клешни слева и кнопка опускания справа. */
export class ControlsController extends LiveContainer {
  /** Высота блока в дизайн-единицах: по ней сцена ставит его над нижним краем. */
  readonly heightUnits: number

  constructor(claw: ClawController, toyboxStore: ToyboxStore, emitter: GameEmitter<GameEvents>) {
    super()

    const joystick = new JoystickController(claw, toyboxStore)
    const dropButton = new DropButtonController(toyboxStore, emitter)

    joystick.position.set(JOYSTICK_OFFSET_X, 0)
    dropButton.position.set(DROP_OFFSET_X, 0)

    this.heightUnits = Math.max(2 * joystick.radiusUnits, dropButton.sizeUnits)

    this.addChild(joystick, dropButton)
  }
}
