import { inject, injectable } from 'inversify'

import { FIELD_CENTER } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { ContentsController } from '#src/controllers/box/contents'
import type { HeapStore } from '#src/stores/heap'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { Phase } from '@pixi-demos/core/fsm/types'

/** Фаза возврата: клешня встаёт в покой над центром поля. */
@injectable()
export class ReturningPhase implements Phase<PhaseName> {
  readonly name = PhaseName.returning

  private readonly claw: ClawController

  private readonly contents: ContentsController
  private readonly heap: HeapStore
  private readonly toyboxStore: ToyboxStore

  constructor(
    @inject(TOYBOX_TOKENS.ClawController) claw: ClawController,
    @inject(TOYBOX_TOKENS.ContentsController) contents: ContentsController,
    @inject(TOYBOX_TOKENS.HeapStore) heap: HeapStore,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore
  ) {
    this.claw = claw
    this.contents = contents
    this.heap = heap
    this.toyboxStore = toyboxStore
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.idle> {
    await this.claw.moveTo(FIELD_CENTER, signal)
    await this.contents.waitForSettled(signal)
    this.toyboxStore.publishCheckpoint(this.heap.takeSnapshot(this.toyboxStore.collected))

    return PhaseName.idle
  }
}
