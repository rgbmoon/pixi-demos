import { inject, injectable } from 'inversify'

import { TRAY_CENTER } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import { TOYBOX_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { Phase } from '@pixi-demos/core/fsm/types'

/** Фаза доставки: клешня идёт к центру лотка. */
@injectable()
export class DeliveringPhase implements Phase<PhaseName> {
  readonly name = PhaseName.delivering

  private readonly claw: ClawController

  constructor(@inject(TOYBOX_TOKENS.ClawController) claw: ClawController) {
    this.claw = claw
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.releasing> {
    await this.claw.moveTo(TRAY_CENTER, signal)

    return PhaseName.releasing
  }
}
