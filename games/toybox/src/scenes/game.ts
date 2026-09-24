import { inject, injectable } from 'inversify'
import { Container } from 'pixi.js'

import { DROP_BUTTON_CENTER, JOYSTICK_CENTER, PRIZE_HATCH_CENTER, RESET_BUTTON_CENTER } from '#src/constants'
import type { CubeController } from '#src/controllers/box/cube'
import type { MarqueeController } from '#src/controllers/box/marquee'
import type { PrizeOutputController } from '#src/controllers/box/prize-output'
import type { DropButtonController } from '#src/controllers/hud/drop-button'
import type { JoystickController } from '#src/controllers/hud/joystick'
import type { ResetButtonController } from '#src/controllers/hud/reset-button'
import type { KeyboardController } from '#src/controllers/keyboard'
import type { PersistenceController } from '#src/controllers/persistence'
import { TOYBOX_TOKENS } from '#src/tokens'
import { Cabinet } from '#src/ui/box/cabinet'
import { getMachineLayout } from '#src/utils/machine-geometry'
import { worldToScreen } from '#src/utils/projection'

/** Сцена: корпус автомата вписывается в канвас одним масштабом и центрируется. */
@injectable()
export class GameScene extends Container {
  private readonly machine = new Container()

  constructor(
    @inject(TOYBOX_TOKENS.CubeController) cube: CubeController,
    @inject(TOYBOX_TOKENS.JoystickController) joystick: JoystickController,
    @inject(TOYBOX_TOKENS.DropButtonController) drop: DropButtonController,
    @inject(TOYBOX_TOKENS.MarqueeController) marquee: MarqueeController,
    @inject(TOYBOX_TOKENS.PrizeOutputController) prizeOutput: PrizeOutputController,
    @inject(TOYBOX_TOKENS.ResetButtonController) reset: ResetButtonController,
    @inject(TOYBOX_TOKENS.KeyboardController) keyboard: KeyboardController,
    @inject(TOYBOX_TOKENS.PersistenceController) persistence: PersistenceController
  ) {
    super()

    // Точки установки постоянны в координатах корпуса, поэтому от размера канваса не зависят
    const placements = [
      [prizeOutput, PRIZE_HATCH_CENTER],
      [reset, RESET_BUTTON_CENTER],
      [joystick, JOYSTICK_CENTER],
      [drop, DROP_BUTTON_CENTER],
    ] as const

    for (const [controller, point] of placements) {
      const { x, y } = worldToScreen(point)

      controller.position.set(x, y)
    }

    this.machine.addChild(cube, new Cabinet(), joystick, drop, marquee, prizeOutput, reset)
    this.addChild(this.machine, keyboard, persistence)
  }

  layout(width: number, height: number): void {
    const { scale, x, y } = getMachineLayout(width, height)

    this.machine.scale.set(scale)
    this.machine.position.set(x, y)
  }
}
