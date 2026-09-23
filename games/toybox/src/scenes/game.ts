import { inject, injectable } from 'inversify'
import { Container } from 'pixi.js'

import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  DROP_BUTTON_CENTER,
  JOYSTICK_CENTER,
  PRIZE_HATCH_CENTER,
  RESET_BUTTON_CENTER,
} from '#src/constants'
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

/** Сцена центрирует измеренные границы всего автомата в фиксированной дизайн-системе координат. */
@injectable()
export class GameScene extends Container {
  private readonly content = new Container()
  private readonly machine = new Container()
  private readonly prizeOutput: PrizeOutputController
  private readonly reset: ResetButtonController
  private readonly joystick: JoystickController
  private readonly drop: DropButtonController

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

    this.prizeOutput = prizeOutput
    this.reset = new ResetButtonController(toyboxStore, emitter)
    this.joystick = new JoystickController(toyboxStore)
    this.drop = new DropButtonController(toyboxStore, emitter)

    const marquee = new MarqueeController(ticker, toyboxStore, emitter)
    const keyboardController = new KeyboardController(keyboard, toyboxStore, emitter)

    this.machine.addChild(
      new Floor(), new Frame(), contents, new Cabinet(), this.joystick, this.drop, marquee, prizeOutput, this.reset
    )
    this.content.addChild(this.machine, keyboardController)
    this.addChild(this.content, persistence)
  }

  layout(screenWidth: number, screenHeight: number): void {
    const contentScale = Math.min(screenWidth / DESIGN_WIDTH, screenHeight / DESIGN_HEIGHT)

    this.content.scale.set(contentScale)
    this.content.position.set(
      (screenWidth - DESIGN_WIDTH * contentScale) / 2,
      (screenHeight - DESIGN_HEIGHT * contentScale) / 2
    )

    const viewWidth = screenWidth / contentScale
    const viewHeight = screenHeight / contentScale
    const viewLeft = (DESIGN_WIDTH - viewWidth) / 2
    const viewTop = (DESIGN_HEIGHT - viewHeight) / 2
    const machine = getMachineLayout(viewLeft, viewTop, viewWidth, viewHeight)

    this.machine.scale.set(machine.scale)
    this.machine.position.set(machine.x, machine.y)

    const placements = [
      [this.prizeOutput, PRIZE_HATCH_CENTER],
      [this.reset, RESET_BUTTON_CENTER],
      [this.joystick, JOYSTICK_CENTER],
      [this.drop, DROP_BUTTON_CENTER],
    ] as const

    for (const [view, point] of placements) {
      const screen = worldToScreen(point)

      view.position.set(screen.x, screen.y)
    }
  }
}
