import { inject, injectable } from 'inversify'

import type { ClawRig } from '#src/claw/claw-rig'
import { FIELD_CENTER } from '#src/constants'
import type { Heap } from '#src/heap/heap'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { Phase } from '@pixi-demos/core/fsm/types'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/** Фаза возврата: клешня встаёт в покой над центром поля; после покоя кучи фаза публикует снимок цикла. */
@injectable()
export class ReturningPhase implements Phase<PhaseName> {
  readonly name = PhaseName.returning

  private readonly ticker: GameTicker
  private readonly rig: ClawRig
  private readonly heap: Heap
  private readonly toyboxStore: ToyboxStore

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.ClawRig) rig: ClawRig,
    @inject(TOYBOX_TOKENS.Heap) heap: Heap,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore
  ) {
    this.ticker = ticker
    this.rig = rig
    this.heap = heap
    this.toyboxStore = toyboxStore
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.idle> {
    await this.rig.moveTo(FIELD_CENTER, signal)
    await this.ticker.waitUntil(() => this.heap.settled, signal)
    this.toyboxStore.publishCheckpoint(this.heap.takeSnapshot())

    return PhaseName.idle
  }
}
