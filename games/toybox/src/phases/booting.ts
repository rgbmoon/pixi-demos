import { inject, injectable } from 'inversify'

import type { GameEvents } from '#src/events'
import type { HeapStore } from '#src/stores/heap'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { type HeapSnapshot, PhaseName } from '#src/types'
import { isHeapSnapshot } from '#src/utils/heap'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { Phase } from '@pixi-demos/core/fsm/types'
import type { IdbStorage } from '@pixi-demos/core/idb-storage'

/**
 * Стартовая фаза: восстанавливает кучу из хранилища, а при отсутствии совместимого снимка создаёт
 * новую. Дальше объявляет игру готовой и переводит автомат в покой.
 */
@injectable()
export class BootingPhase implements Phase<PhaseName> {
  readonly name = PhaseName.booting

  private readonly emitter: GameEmitter<GameEvents>
  private readonly heap: HeapStore
  private readonly toyboxStore: ToyboxStore
  private readonly storage: IdbStorage<HeapSnapshot>

  constructor(
    @inject(TOYBOX_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(TOYBOX_TOKENS.HeapStore) heap: HeapStore,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore,
    @inject(TOYBOX_TOKENS.HeapStorage) storage: IdbStorage<HeapSnapshot>
  ) {
    this.emitter = emitter
    this.heap = heap
    this.toyboxStore = toyboxStore
    this.storage = storage
  }

  async enter(): Promise<typeof PhaseName.idle> {
    const stored = await this.storage.read()
    const snapshot = isHeapSnapshot(stored) ? stored : undefined

    this.heap.restore(snapshot, Math.random)
    this.toyboxStore.applyCollected(snapshot?.collected ?? 0)
    this.emitter.emit('game:booted')

    return PhaseName.idle
  }
}
