import { inject, injectable } from 'inversify'

import { GRAB_CHANCE, GRAB_HOLD_MS } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { ContentsController } from '#src/controllers/box/contents'
import { TOYBOX_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { Phase } from '@pixi-demos/core/fsm/types'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/**
 * Фаза захвата: клешня сжимается на верху стопки и с вероятностью `GRAB_CHANCE` уносит её верхнюю
 * игрушку. После промаха клешня идёт к лотку пустой.
 */
@injectable()
export class GrabbingPhase implements Phase<PhaseName> {
  readonly name = PhaseName.grabbing

  private readonly ticker: GameTicker
  private readonly claw: ClawController
  private readonly contents: ContentsController

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.ClawController) claw: ClawController,
    @inject(TOYBOX_TOKENS.ContentsController) contents: ContentsController
  ) {
    this.ticker = ticker
    this.claw = claw
    this.contents = contents
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.ascending> {
    await this.ticker.waitTicks(GRAB_HOLD_MS, signal)

    if (Math.random() < GRAB_CHANCE) {
      const toy = this.contents.take(this.claw.getCell())

      if (toy) this.claw.hold(toy)
    }

    return PhaseName.ascending
  }
}
