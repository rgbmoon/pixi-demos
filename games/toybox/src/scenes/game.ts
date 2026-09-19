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
import { ControlsController } from '#src/controllers/hud/controls'
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

  constructor(
    @inject(TOYBOX_TOKENS.ClawController) claw: ClawController,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore,
    @inject(TOYBOX_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>
  ) {
    super()

    this.box = new BoxController(claw)
    this.controls = new ControlsController(claw, toyboxStore, emitter)

    this.content.addChild(this.box, this.controls)
    this.addChild(this.content)
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

    // Куб занимает поле между верхом видимой области и блоком управления; начало его координат —
    // ближний угол пола, поэтому позиция задаётся нижней точкой ромба
    const playAreaTop = viewTop + BOX_TOP_MARGIN
    const playAreaHeight = controlsCenterY - this.controls.heightUnits / 2 - SCREEN_MARGIN - playAreaTop
    const boxScale = Math.min(1, (viewWidth - 2 * SCREEN_MARGIN) / FLOOR_WIDTH, playAreaHeight / BOX_HEIGHT)

    // Куб прижат к верху игровой области: свободное место остаётся под ним, у блока управления.
    // Пол несимметричен относительно начала координат куба, поэтому центрируется со сдвигом
    this.box.scale.set(boxScale)
    this.box.position.set(centerX + BOX_CENTER_OFFSET_X * boxScale, playAreaTop + BOX_HEIGHT * boxScale)
  }
}
