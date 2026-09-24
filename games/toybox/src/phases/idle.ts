import { inject, injectable } from 'inversify'

import type { GameEvents } from '#src/events'
import type { Heap } from '#src/heap/heap'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { Phase } from '@pixi-demos/core/fsm/types'

/**
 * Фаза покоя. Здесь же принимается сброс кучи: он не меняет фазу, поэтому его принимает подписка
 * на время фазы.
 */
@injectable()
export class IdlePhase implements Phase<PhaseName> {
  readonly name = PhaseName.idle

  private readonly emitter: GameEmitter<GameEvents>
  private readonly heap: Heap
  private readonly toyboxStore: ToyboxStore

  constructor(
    @inject(TOYBOX_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(TOYBOX_TOKENS.Heap) heap: Heap,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore
  ) {
    this.emitter = emitter
    this.heap = heap
    this.toyboxStore = toyboxStore
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.descending> {
    const unsubscribe = this.emitter.on('ui:resetRequested', () => this.reset(), { signal })

    try {
      await this.emitter.waitFor('ui:dropRequested', { signal, filter: () => this.toyboxStore.canDrop })
    } finally {
      unsubscribe()
    }

    return PhaseName.descending
  }

  /** Новая игра: куча насыпается заново, счёт обнуляется. */
  private reset(): void {
    if (!this.toyboxStore.canReset) return

    this.heap.restore(undefined, Math.random)
    this.toyboxStore.applyCollected(0)
    this.toyboxStore.publishCheckpoint(this.heap.takeSnapshot(0))
    this.emitter.emit('heap:reset')
  }
}
