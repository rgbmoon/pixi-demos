import { inject, injectable } from 'inversify'

import { GRAB_HOLD_MS, PHASE_PAUSE_MS } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { HeapStore } from '#src/stores/heap'
import { TOYBOX_TOKENS } from '#src/tokens'
import { type CellAddress, PhaseName } from '#src/types'
import { getGrabChance, getWeight } from '#src/utils/heap'
import type { Phase } from '@pixi-demos/core/fsm/types'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/**
 * Фаза захвата: клешня сжимается на верху стопки и уносит верхнюю игрушку ячейки. Шанс тем ниже,
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
    await this.ticker.waitTicks(GRAB_HOLD_MS, signal)

    const cell = this.claw.getCell()

    if (Math.random() < this.getChance(cell)) {
      const id = this.heap.lift(cell)

      if (id !== undefined) this.claw.hold(id)
    }

    await this.ticker.waitTicks(PHASE_PAUSE_MS, signal)

    return PhaseName.ascending
  }

  /** Доля успешных захватов игрушки в ячейке; над пустой ячейкой захватывать нечего. */
  private getChance(cell: CellAddress): number {
    const body = this.heap.getTopBody(cell)

    return body ? getGrabChance(getWeight(body.shape), this.heap.getLoad(body.id)) : 0
  }
}
