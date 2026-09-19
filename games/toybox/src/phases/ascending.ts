import { inject, injectable } from 'inversify'

import type { ClawController } from '#src/controllers/box/claw'
import { TOYBOX_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { Phase } from '@pixi-demos/core/fsm/types'

/** Фаза подъёма: клешня возвращается к верхней грани. Сюда встанет срыв игрушки. */
@injectable()
export class AscendingPhase implements Phase<PhaseName> {
  readonly name = PhaseName.ascending

  private readonly claw: ClawController

  constructor(@inject(TOYBOX_TOKENS.ClawController) claw: ClawController) {
    this.claw = claw
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.delivering> {
    await this.claw.ascend(signal)

    return PhaseName.delivering
  }
}
