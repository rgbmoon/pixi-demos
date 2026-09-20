import { inject, injectable } from 'inversify'

import type { ClawController } from '#src/controllers/box/claw'
import type { ContentsController } from '#src/controllers/box/contents'
import { TOYBOX_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { Phase } from '@pixi-demos/core/fsm/types'

/** Фаза опускания клешни */
@injectable()
export class DescendingPhase implements Phase<PhaseName> {
  readonly name = PhaseName.descending

  private readonly claw: ClawController
  private readonly contents: ContentsController

  constructor(
    @inject(TOYBOX_TOKENS.ClawController) claw: ClawController,
    @inject(TOYBOX_TOKENS.ContentsController) contents: ContentsController
  ) {
    this.claw = claw
    this.contents = contents
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.grabbing> {
    await this.claw.descend(this.contents.getStackHeight(this.claw.getCell()), signal)

    return PhaseName.grabbing
  }
}
