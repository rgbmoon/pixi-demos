import { inject, injectable } from 'inversify'
import { Container } from 'pixi.js'

import { DROP_BUTTON_CENTER, JOYSTICK_CENTER, PRIZE_HATCH_CENTER, RESET_BUTTON_CENTER } from '#src/constants'
import type { ContentsController } from '#src/controllers/box/contents'
import { MarqueeController } from '#src/controllers/box/marquee'
import type { PrizeOutputController } from '#src/controllers/box/prize-output'
import { DropButtonController } from '#src/controllers/hud/drop-button'
import { JoystickController } from '#src/controllers/hud/joystick'
import { ResetButtonController } from '#src/controllers/hud/reset-button'
import { KeyboardController } from '#src/controllers/keyboard'
import type { PersistenceController } from '#src/controllers/persistence'
import type { GameEvents } from '#src/events'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { Cabinet } from '#src/ui/box/cabinet'
import { Floor } from '#src/ui/box/floor'
import { Frame } from '#src/ui/box/frame'
import { getMachineLayout } from '#src/utils/layout'
import { worldToScreen } from '#src/utils/projection'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { KeyboardInput } from '@pixi-demos/core/keyboard-input'
import { CORE_TOKENS } from '@pixi-demos/core/tokens'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/** Сцена: корпус автомата вписывается в канвас одним масштабом и центрируется. */
@injectable()
export class GameScene extends Container {
  private readonly machine = new Container()

  constructor(
    @inject(TOYBOX_TOKENS.ContentsController) contents: ContentsController,
    @inject(TOYBOX_TOKENS.PersistenceController) persistence: PersistenceController,
    @inject(TOYBOX_TOKENS.PrizeOutputController) prizeOutput: PrizeOutputController,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore,
    @inject(TOYBOX_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(CORE_TOKENS.KeyboardInput) keyboard: KeyboardInput
  ) {
    super()

    const reset = new ResetButtonController(toyboxStore, emitter)
    const joystick = new JoystickController(toyboxStore)
    const drop = new DropButtonController(toyboxStore, emitter)
    const marquee = new MarqueeController(ticker, toyboxStore, emitter)
    const keyboardController = new KeyboardController(keyboard, toyboxStore, emitter)

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

    this.machine.addChild(new Floor(), new Frame(), contents, new Cabinet(), joystick, drop, marquee, prizeOutput, reset)
    this.addChild(this.machine, keyboardController, persistence)
  }

  layout(width: number, height: number): void {
    const { scale, x, y } = getMachineLayout(width, height)

    this.machine.scale.set(scale)
    this.machine.position.set(x, y)
  }
}
