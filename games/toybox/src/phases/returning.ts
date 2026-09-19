import { inject, injectable } from 'inversify'

import { FIELD_CENTER } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import { TOYBOX_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { Phase } from '@pixi-demos/core/fsm/types'

/** Фаза возврата: клешня встаёт в покой над центром поля. */
@injectable()
export class ReturningPhase implements Phase<PhaseName> {
  readonly name = PhaseName.returning

  private readonly claw: ClawController

  constructor(@inject(TOYBOX_TOKENS.ClawController) claw: ClawController) {
    this.claw = claw
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.idle> {
    await this.claw.moveTo(FIELD_CENTER, signal)

    return PhaseName.idle
  }
}
