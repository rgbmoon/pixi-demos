import { inject, injectable } from 'inversify'

import { PHASE_PAUSE_MS } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { Heap } from '#src/heap/heap'
import { TOYBOX_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { Phase } from '@pixi-demos/core/fsm/types'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/**
 * Фаза захвата: клешня сжимается на верху кучи и уносит игрушку под собой. Шанс тем ниже,
 * чем тяжелее игрушка и чем больше на ней лежит сверху. После промаха клешня идёт к лотку пустой.
 */
@injectable()
export class GrabbingPhase implements Phase<PhaseName> {
  readonly name = PhaseName.grabbing

  private readonly ticker: GameTicker
  private readonly claw: ClawController
  private readonly heap: Heap

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.ClawController) claw: ClawController,
    @inject(TOYBOX_TOKENS.Heap) heap: Heap
  ) {
    this.ticker = ticker
    this.claw = claw
    this.heap = heap
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.ascending> {
    const point = this.claw.getCartPoint()
    const lifted = Math.random() < this.heap.getGrabChance(point) && this.heap.lift(point, this.claw.getGripPoint())

    // При промахе клешня прожимает игрушку под собой
    if (!lifted) this.heap.press(point)

    await this.claw.grab(signal)
    await this.ticker.waitTicks(PHASE_PAUSE_MS, signal)

    return PhaseName.ascending
  }
}
