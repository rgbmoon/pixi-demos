import { inject, injectable } from 'inversify'

import { TRAY_HOLD_MS } from '#src/constants'
import { PhaseName } from '#src/types'
import type { Phase } from '@pixi-demos/core/fsm/types'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/**
 * Фаза сброса: клешня стоит над лотком, пока игрушка падает и клешня разжимается.
 * Анимаций пока нет, выдержку держит сама фаза.
 */
@injectable()
export class ReleasingPhase implements Phase<PhaseName> {
  readonly name = PhaseName.releasing

  private readonly ticker: GameTicker

  constructor(@inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker) {
    this.ticker = ticker
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.returning> {
    await this.ticker.waitTicks(TRAY_HOLD_MS, signal)

    return PhaseName.returning
  }
}
