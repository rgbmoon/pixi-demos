import { inject, injectable } from 'inversify'

import { PRIZE_OPEN_HOLD_MS, PRIZE_PAUSE_MS } from '#src/constants'
import type { PrizeOutputController } from '#src/controllers/box/prize-output'
import type { GameEvents } from '#src/events'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { Phase } from '@pixi-demos/core/fsm/types'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/** Последовательно показывает приз, открывает дверцу и завершает получение. */
@injectable()
export class PresentingPhase implements Phase<PhaseName> {
  readonly name = PhaseName.presenting

  private readonly ticker: GameTicker
  private readonly output: PrizeOutputController
  private readonly store: ToyboxStore
  private readonly emitter: GameEmitter<GameEvents>

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.PrizeOutputController) output: PrizeOutputController,
    @inject(TOYBOX_TOKENS.ToyboxStore) store: ToyboxStore,
    @inject(TOYBOX_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>
  ) {
    this.ticker = ticker
    this.output = output
    this.store = store
    this.emitter = emitter
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.returning> {
    const { prize } = this.store

    if (!prize) throw new Error('Missing prize presentation')

    this.output.show(prize.appearance)
    try {
      await this.ticker.waitTicks(PRIZE_PAUSE_MS, signal)
      await this.output.open(signal)
      await this.ticker.waitTicks(PRIZE_OPEN_HOLD_MS, signal)
      await this.output.take(signal)
      this.emitter.emit('prize:taken', { collected: prize.collected })
      await this.output.close(signal)
      this.store.finishPrize()
    } finally {
      this.output.hide()
    }

    return PhaseName.returning
  }
}
