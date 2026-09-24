import { inject, injectable } from 'inversify'

import type { ClawRig } from '#src/claw/claw-rig'
import { PHASE_PAUSE_MS } from '#src/constants'
import type { Heap } from '#src/heap/heap'
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
  private readonly rig: ClawRig
  private readonly heap: Heap

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.ClawRig) rig: ClawRig,
    @inject(TOYBOX_TOKENS.Heap) heap: Heap
  ) {
    this.ticker = ticker
    this.rig = rig
    this.heap = heap
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.grabbing> {
    await this.rig.descend(this.heap.getSurfaceHeightAt(this.rig.getCartPoint()), signal)
    await this.ticker.waitTicks(PHASE_PAUSE_MS, signal)

    return PhaseName.grabbing
  }
}
