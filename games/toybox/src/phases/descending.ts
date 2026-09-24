import { inject, injectable } from 'inversify'

import { PHASE_PAUSE_MS } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { HeapStore } from '#src/stores/heap'
import { TOYBOX_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { Phase } from '@pixi-demos/core/fsm/types'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/** Фаза опускания клешни */
@injectable()
export class DescendingPhase implements Phase<PhaseName> {
  readonly name = PhaseName.descending

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

  async enter(signal: AbortSignal): Promise<typeof PhaseName.grabbing> {
    await this.claw.descend(this.heap.getSurfaceHeightAt(this.claw.getCartPoint()), signal)
    await this.ticker.waitTicks(PHASE_PAUSE_MS, signal)

    return PhaseName.grabbing
  }
}
