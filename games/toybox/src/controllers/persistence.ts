import { inject, injectable } from 'inversify'
import type { DestroyOptions } from 'pixi.js'

import type { HeapStore } from '#src/stores/heap'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import type { HeapSnapshot } from '#src/types'
import type { IdbStorage } from '@pixi-demos/core/idb-storage'
import { LiveContainer } from '@pixi-demos/engine/live-container'

/**
 * Сохранение кучи: сохраняет снэпшот, когда куча пришла в покой, и на уходе со страницы.
 * В рендере не участвует; в дереве сцены только ради владения подписками.
 */
@injectable()
export class PersistenceController extends LiveContainer {
  private readonly heap: HeapStore
  private readonly toyboxStore: ToyboxStore
  private readonly storage: IdbStorage<HeapSnapshot>

  constructor(
    @inject(TOYBOX_TOKENS.HeapStore) heap: HeapStore,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore,
    @inject(TOYBOX_TOKENS.HeapStorage) storage: IdbStorage<HeapSnapshot>
  ) {
    super()

    this.heap = heap
    this.toyboxStore = toyboxStore
    this.storage = storage

    this.watch(
      () => heap.settled,
      (settled) => {
        if (settled) this.save()
      }
    )

    // Счёт меняется после стабилизации кучи, поэтому для него нужна отдельная реакция
    this.watch(
      () => toyboxStore.collected,
      () => {
        if (heap.settled) this.save()
      }
    )

    // Сброс может не изменить ни `settled`, ни нулевой счёт
    this.watch(
      () => heap.generation,
      () => this.save()
    )

    window.addEventListener('pagehide', this.save)
  }

  override destroy(options?: DestroyOptions): void {
    window.removeEventListener('pagehide', this.save)

    super.destroy(options)
  }

  private save = (): void => {
    void this.storage.write(this.heap.takeSnapshot(this.toyboxStore.collected))
  }
}
