import { inject, injectable } from 'inversify'

import { TRAY_FALL_MS, TRAY_HOLD_MS, TRAY_RELEASE_MS } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { HeapStore } from '#src/stores/heap'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { Phase } from '@pixi-demos/core/fsm/types'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/**
 * Фаза сброса: клешня выдерживает паузу над лотком и разжимается. Донесённая игрушка уходит в лоток
 * и в счётчик, пустая клешня просто стоит.
 */
@injectable()
export class ReleasingPhase implements Phase<PhaseName> {
  readonly name = PhaseName.releasing

  private readonly ticker: GameTicker
  private readonly claw: ClawController
  private readonly heap: HeapStore
  private readonly toyboxStore: ToyboxStore

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.ClawController) claw: ClawController,
    @inject(TOYBOX_TOKENS.HeapStore) heap: HeapStore,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore
  ) {
    this.ticker = ticker
    this.claw = claw
    this.heap = heap
    this.toyboxStore = toyboxStore
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.returning> {
    if (!this.claw.isHolding()) {
      await this.ticker.waitTicks(TRAY_HOLD_MS, signal)

      return PhaseName.returning
    }

    await this.ticker.waitTicks(TRAY_RELEASE_MS, signal)

    const id = this.claw.release()

    if (id === undefined) return PhaseName.returning

    this.heap.dropIntoTray(id)

    await this.ticker.waitTicks(TRAY_FALL_MS, signal)
    this.toyboxStore.recordCollection()

    return PhaseName.returning
  }
}
