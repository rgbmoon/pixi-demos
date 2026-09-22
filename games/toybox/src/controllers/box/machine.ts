import { PRIZE_HATCH_CENTER, RESET_BUTTON_CENTER } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import { ControlsController } from '#src/controllers/hud/controls'
import { ResetButtonController } from '#src/controllers/hud/reset-button'
import type { GameEvents } from '#src/events'
import type { ToyboxStore } from '#src/stores/toybox'
import { Cabinet } from '#src/ui/box/cabinet'
import { worldToScreen } from '#src/utils/projection'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'

import { BoxController } from './box'
import type { ContentsController } from './contents'
import { MarqueeController } from './marquee'
import type { PrizeOutputController } from './prize-output'

/** Весь автомат в одной системе координат: стекло, корпус, встроенный HUD и окно выдачи. */
export class MachineController extends LiveContainer {
  constructor(
    contents: ContentsController,
    claw: ClawController,
    toyboxStore: ToyboxStore,
    emitter: GameEmitter<GameEvents>,
    ticker: GameTicker,
    prizeOutput: PrizeOutputController
  ) {
    super()

    const box = new BoxController(contents)
    const cabinet = new Cabinet()
    const controls = new ControlsController(claw, toyboxStore, emitter)
    const marquee = new MarqueeController(ticker, toyboxStore, emitter)
    const reset = new ResetButtonController(toyboxStore, emitter)
    const prizeCenter = worldToScreen(PRIZE_HATCH_CENTER)
    const resetCenter = worldToScreen(RESET_BUTTON_CENTER)

    // расстановку позицию обычно делаем в layout методе
    prizeOutput.position.set(prizeCenter.x, prizeCenter.y)
    reset.position.set(resetCenter.x, resetCenter.y)

    this.addChild(box, cabinet, controls, marquee, prizeOutput, reset)
  }
}
