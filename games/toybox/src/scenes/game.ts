import { inject, injectable } from 'inversify'
import { Container } from 'pixi.js'

import { DESIGN_HEIGHT, DESIGN_WIDTH } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { ContentsController } from '#src/controllers/box/contents'
import { MachineController } from '#src/controllers/box/machine'
import type { PrizeOutputController } from '#src/controllers/box/prize-output'
import { KeyboardController } from '#src/controllers/keyboard'
import type { PersistenceController } from '#src/controllers/persistence'
import type { GameEvents } from '#src/events'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { getMachineLayout } from '#src/utils/layout'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { KeyboardInput } from '@pixi-demos/core/keyboard-input'
import { CORE_TOKENS } from '@pixi-demos/core/tokens'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/** Сцена центрирует измеренные границы всего автомата в фиксированной дизайн-системе координат. */
@injectable()
export class GameScene extends Container {
  private readonly content = new Container()
  private readonly machine: MachineController

  constructor(
    @inject(TOYBOX_TOKENS.ClawController) claw: ClawController,
    @inject(TOYBOX_TOKENS.ContentsController) contents: ContentsController,
    @inject(TOYBOX_TOKENS.PersistenceController) persistence: PersistenceController,
    @inject(TOYBOX_TOKENS.PrizeOutputController) prizeOutput: PrizeOutputController,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore,
    @inject(TOYBOX_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(CORE_TOKENS.KeyboardInput) keyboard: KeyboardInput
  ) {
    super()

    this.machine = new MachineController(contents, claw, toyboxStore, emitter, ticker, prizeOutput)

    const keyboardController = new KeyboardController(keyboard, claw, toyboxStore, emitter)

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
  }
}
