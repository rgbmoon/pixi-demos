import { inject, injectable } from 'inversify'

import { TRAY_HOLD_MS } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { ContentsController } from '#src/controllers/box/contents'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { Phase } from '@pixi-demos/core/fsm/types'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/**
 * Фаза сброса: клешня разжимается над лотком. Донесённая игрушка уходит в лоток и в счётчик,
 * пустая клешня просто выдерживает паузу.
 */
@injectable()
export class ReleasingPhase implements Phase<PhaseName> {
  readonly name = PhaseName.releasing

  private readonly ticker: GameTicker
  private readonly claw: ClawController
  private readonly contents: ContentsController
  private readonly toyboxStore: ToyboxStore

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.ClawController) claw: ClawController,
    @inject(TOYBOX_TOKENS.ContentsController) contents: ContentsController,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore
  ) {
    this.ticker = ticker
    this.claw = claw
    this.contents = contents
    this.toyboxStore = toyboxStore
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.returning> {
    const toy = this.claw.release()

    if (!toy) {
      await this.ticker.waitTicks(TRAY_HOLD_MS, signal)

      return PhaseName.returning
    }

    await this.contents.collect(toy, signal)
    this.toyboxStore.collect()

    return PhaseName.returning
  }
}
