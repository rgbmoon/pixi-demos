import { inject, injectable } from 'inversify'

import type { ClawController } from '#src/controllers/box/claw'
import type { ContentsController } from '#src/controllers/box/contents'
import { TOYBOX_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { Phase } from '@pixi-demos/core/fsm/types'

/**
 * Фаза подъёма: клешня возвращается к верхней грани с тем, что смогла захватить.
 */
@injectable()
export class AscendingPhase implements Phase<PhaseName> {
  readonly name = PhaseName.ascending

  private readonly claw: ClawController
  private readonly contents: ContentsController

  constructor(
    @inject(TOYBOX_TOKENS.ClawController) claw: ClawController,
    @inject(TOYBOX_TOKENS.ContentsController) contents: ContentsController
  ) {
    this.claw = claw
    this.contents = contents
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.delivering> {
    const lifted = this.claw.isHolding()

    await this.claw.ascend(signal)

    if (lifted) this.contents.settle()

    return PhaseName.delivering
  }
}
