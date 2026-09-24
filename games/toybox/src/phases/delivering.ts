import { inject, injectable } from 'inversify'

import { FUMBLE_CHANCE, TRAY_CENTER } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { HeapStore } from '#src/stores/heap'
import { TOYBOX_TOKENS } from '#src/tokens'
import { type ClawDrop, type GroundPoint, PhaseName } from '#src/types'
import { pickFumbleShare } from '#src/utils/grid'
import type { Phase } from '@pixi-demos/core/fsm/types'

/**
 * Фаза доставки: клешня одним ходом движется к лотку. С вероятностью `FUMBLE_CHANCE` она роняет
 * игрушку по дороге — вдали от места захвата и до лотка, — и та падает в кучу.
 */
@injectable()
export class DeliveringPhase implements Phase<PhaseName> {
  readonly name = PhaseName.delivering

  private readonly claw: ClawController
  private readonly heap: HeapStore

  constructor(
    @inject(TOYBOX_TOKENS.ClawController) claw: ClawController,
    @inject(TOYBOX_TOKENS.HeapStore) heap: HeapStore
  ) {
    this.claw = claw
    this.heap = heap
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.releasing> {
    await this.claw.carryTo(TRAY_CENTER, this.rollFumble(TRAY_CENTER), signal)

    return PhaseName.releasing
  }

  private rollFumble(target: GroundPoint): ClawDrop | undefined {
    if (!this.heap.isHolding || Math.random() >= FUMBLE_CHANCE) return undefined

    const share = pickFumbleShare(this.claw.getCartPoint(), target, Math.random)

    if (share === undefined) return undefined

    return {
      share,
      onDrop: (grip) => {
        this.heap.release(grip)
      },
    }
  }
}
