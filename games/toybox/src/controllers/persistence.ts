import { inject, injectable } from 'inversify'
import type { DestroyOptions } from 'pixi.js'

import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import type { HeapSnapshot } from '#src/types'
import type { IdbStorage } from '@pixi-demos/core/idb-storage'
import { LiveContainer } from '@pixi-demos/engine/live-container'

/** Сохраняет опубликованный завершённый цикл; уход со страницы повторяет последний снимок. */
@injectable()
export class PersistenceController extends LiveContainer {
  private readonly toyboxStore: ToyboxStore
  private readonly storage: IdbStorage<HeapSnapshot>

  constructor(
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore,
    @inject(TOYBOX_TOKENS.HeapStorage) storage: IdbStorage<HeapSnapshot>
  ) {
    super()
    this.toyboxStore = toyboxStore
    this.storage = storage
    this.watch(() => toyboxStore.checkpoint, this.save, { fireImmediately: true })
    window.addEventListener('pagehide', this.save)
  }

  override destroy(options?: DestroyOptions): void {
    if (this.destroyed) return

    window.removeEventListener('pagehide', this.save)
    super.destroy(options)
  }

  private save = (): void => {
    const snapshot = this.toyboxStore.checkpoint

    if (snapshot) void this.storage.write(snapshot)
  }
}
