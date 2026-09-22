import { inject, injectable } from 'inversify'
import { Container } from 'pixi.js'

import {
  BOX_CENTER_OFFSET_X,
  BOX_HEIGHT,
  BOX_TOP_MARGIN,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  FLOOR_WIDTH,
  SCREEN_MARGIN,
} from '#src/constants'
import { BoxController } from '#src/controllers/box/box'
import type { ClawController } from '#src/controllers/box/claw'
import type { ContentsController } from '#src/controllers/box/contents'
import { ControlsController } from '#src/controllers/hud/controls'
import { CounterController } from '#src/controllers/hud/counter'
import { ResetButtonController } from '#src/controllers/hud/reset-button'
import type { PersistenceController } from '#src/controllers/persistence'
import type { GameEvents } from '#src/events'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'

/**
 * Сцена игры: бокс в верхней части экрана, блок управления под ним.
 * Раскладка ведётся в дизайн-единицах макета, контент вписывается в канвас целиком и центрируется.
 */
@injectable()
export class GameScene extends Container {
  // Пропорции канваса могут отличаться от макета, поэтому контент масштабируется отдельно
  private readonly content = new Container()
  private readonly box: BoxController
  private readonly controls: ControlsController
  private readonly counter: CounterController
  private readonly resetButton: ResetButtonController

  constructor(
    @inject(TOYBOX_TOKENS.ClawController) claw: ClawController,
    @inject(TOYBOX_TOKENS.ContentsController) contents: ContentsController,
    @inject(TOYBOX_TOKENS.PersistenceController) persistence: PersistenceController,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore,
    @inject(TOYBOX_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>
  ) {
    super()

    this.box = new BoxController(contents)
    this.controls = new ControlsController(claw, toyboxStore, emitter)
    this.counter = new CounterController(toyboxStore)
    this.resetButton = new ResetButtonController(toyboxStore, emitter)

    this.content.addChild(this.box, this.controls, this.counter, this.resetButton)
    this.addChild(this.content, persistence)
  }

  layout(screenWidth: number, screenHeight: number): void {
    const contentScale = Math.min(screenWidth / DESIGN_WIDTH, screenHeight / DESIGN_HEIGHT)

    this.content.scale.set(contentScale)
    this.content.position.set(
      (screenWidth - DESIGN_WIDTH * contentScale) / 2,
      (screenHeight - DESIGN_HEIGHT * contentScale) / 2
    )

    // Видимая область в дизайн-единицах: при пропорциях канваса, отличных от макета, она симметрично
    // выходит за макет. Элементы у края экрана позиционируются от её границ
    const viewWidth = screenWidth / contentScale
    const viewHeight = screenHeight / contentScale
    const viewLeft = (DESIGN_WIDTH - viewWidth) / 2
    const viewTop = (DESIGN_HEIGHT - viewHeight) / 2
    const viewBottom = viewTop + viewHeight

    const centerX = viewLeft + viewWidth / 2
    const controlsCenterY = viewBottom - SCREEN_MARGIN - this.controls.heightUnits / 2

    this.controls.position.set(centerX, controlsCenterY)
    this.counter.position.set(viewLeft + SCREEN_MARGIN, viewTop + SCREEN_MARGIN)

    const resetRadius = this.resetButton.sizeUnits / 2

    this.resetButton.position.set(
      viewLeft + viewWidth - SCREEN_MARGIN - resetRadius,
      viewTop + SCREEN_MARGIN + resetRadius
    )

    const counterBottom = viewTop + SCREEN_MARGIN + this.counter.heightUnits
    const playAreaTop = Math.max(viewTop + BOX_TOP_MARGIN, counterBottom + SCREEN_MARGIN)
    const playAreaHeight = controlsCenterY - this.controls.heightUnits / 2 - SCREEN_MARGIN - playAreaTop
    const boxScale = Math.min(1, (viewWidth - 2 * SCREEN_MARGIN) / FLOOR_WIDTH, playAreaHeight / BOX_HEIGHT)

    // Куб прижат к верху игровой области: свободное место остаётся под ним, у блока управления.
    // Пол несимметричен относительно начала координат куба, поэтому центрируется со сдвигом
    this.box.scale.set(boxScale)
    this.box.position.set(centerX + BOX_CENTER_OFFSET_X * boxScale, playAreaTop + BOX_HEIGHT * boxScale)
  }
}
