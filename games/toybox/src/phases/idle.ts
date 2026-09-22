import { inject, injectable } from 'inversify'

import type { GameEvents } from '#src/events'
import type { HeapStore } from '#src/stores/heap'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { Phase } from '@pixi-demos/core/fsm/types'

/**
 * Фаза покоя. Здесь же принимается сброс кучи: он не меняет фазу, поэтому это подписка на время
 * фазы, а не ожидание её конца.
 */
@injectable()
export class IdlePhase implements Phase<PhaseName> {
  readonly name = PhaseName.idle

  private readonly emitter: GameEmitter<GameEvents>
  private readonly heap: HeapStore
  private readonly toyboxStore: ToyboxStore

  constructor(
    @inject(TOYBOX_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(TOYBOX_TOKENS.HeapStore) heap: HeapStore,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore
  ) {
    this.emitter = emitter
    this.heap = heap
    this.toyboxStore = toyboxStore
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.descending> {
    this.emitter.on('ui:resetRequested', () => this.reset(), { signal })

    // Доступность проверяет фаза: запрос в обход кнопки не запустит цикл посреди другого цикла
    await this.emitter.waitFor('ui:dropRequested', { signal, filter: () => this.toyboxStore.canDrop })

    return PhaseName.descending
  }

  /** Новая игра: куча насыпается заново, счёт обнуляется. */
  private reset(): void {
    if (!this.toyboxStore.canReset) return

    this.heap.restore(undefined, Math.random)
    this.toyboxStore.applyCollected(0)
  }
}
