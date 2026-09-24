import { inject, injectable } from 'inversify'

import { PHASE_PAUSE_MS } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { HeapStore } from '#src/stores/heap'
import { TOYBOX_TOKENS } from '#src/tokens'
import { type GroundPoint, PhaseName } from '#src/types'
import { getGrabChance } from '#src/utils/heap'
import { getWeight } from '#src/utils/shapes'
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
  private readonly heap: HeapStore

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.ClawController) claw: ClawController,
    @inject(TOYBOX_TOKENS.HeapStore) heap: HeapStore
  ) {
    this.ticker = ticker
    this.claw = claw
    this.heap = heap
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.ascending> {
    const point = this.claw.getCartPoint()
    const lifted = Math.random() < this.getChance(point) && this.heap.lift(point, this.claw.getGripPoint()) !== undefined

    // При промахе клешня прожимает игрушку под собой
    if (!lifted) this.heap.press(point)

    await this.claw.grab((progress, grip) => this.heap.setGrabProgress(progress, grip), signal)
    await this.ticker.waitTicks(PHASE_PAUSE_MS, signal)

    return PhaseName.ascending
  }

  /** Доля успешных захватов игрушки под точкой; над пустым местом захватывать нечего. */
  private getChance(point: GroundPoint): number {
    const body = this.heap.getTopBodyAt(point)

    return body ? getGrabChance(getWeight(body.shape), this.heap.getLoad(body.id)) : 0
  }
}
