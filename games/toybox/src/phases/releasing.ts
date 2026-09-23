import { inject, injectable } from 'inversify'

import { TRAY_HOLD_MS, TRAY_RELEASE_MS } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { ContentsController } from '#src/controllers/box/contents'
import type { HeapStore } from '#src/stores/heap'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { Phase } from '@pixi-demos/core/fsm/types'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/** Отпускает доставленную игрушку и подтверждает результат прямого падения или прежнего срыва. */
@injectable()
export class ReleasingPhase implements Phase<PhaseName> {
  readonly name = PhaseName.releasing

  private readonly ticker: GameTicker
  private readonly claw: ClawController
  private readonly contents: ContentsController
  private readonly heap: HeapStore
  private readonly toyboxStore: ToyboxStore

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.ClawController) claw: ClawController,
    @inject(TOYBOX_TOKENS.ContentsController) contents: ContentsController,
    @inject(TOYBOX_TOKENS.HeapStore) heap: HeapStore,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore
  ) {
    this.ticker = ticker
    this.claw = claw
    this.contents = contents
    this.heap = heap
    this.toyboxStore = toyboxStore
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.presenting | typeof PhaseName.returning> {
    await this.ticker.waitTicks(this.heap.isHolding ? TRAY_RELEASE_MS : TRAY_HOLD_MS, signal)
    if (this.heap.isHolding) this.heap.dropIntoTray(this.claw.getGripPoint())

    const outcome = await this.contents.waitForRelease(signal)

    if (outcome.status !== 'collected') return PhaseName.returning

    this.toyboxStore.recordCollection(outcome.appearance)

    return PhaseName.presenting
  }
}
