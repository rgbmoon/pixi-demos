import { inject, injectable } from 'inversify'

import type { ClawController } from '#src/controllers/box/claw'
import { TOYBOX_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { Phase } from '@pixi-demos/core/fsm/types'

/** Фаза опускания: клешня идёт от верхней грани до пола. Сюда встанет захват игрушки. */
@injectable()
export class DescendingPhase implements Phase<PhaseName> {
  readonly name = PhaseName.descending

  private readonly claw: ClawController

  constructor(@inject(TOYBOX_TOKENS.ClawController) claw: ClawController) {
    this.claw = claw
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.ascending> {
    await this.claw.descend(signal)

    return PhaseName.ascending
  }
}
