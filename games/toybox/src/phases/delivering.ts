import { inject, injectable } from 'inversify'

import type { ClawRig } from '#src/claw/claw-rig'
import { pickFumbleShare } from '#src/claw/utils'
import { FUMBLE_CHANCE, TRAY_CENTER } from '#src/constants'
import type { Heap } from '#src/heap/heap'
import { TOYBOX_TOKENS } from '#src/tokens'
import { type ClawDrop, type GroundPoint, PhaseName } from '#src/types'
import type { Phase } from '@pixi-demos/core/fsm/types'

/**
 * Фаза доставки: клешня одним ходом движется к лотку. С вероятностью `FUMBLE_CHANCE` она роняет
 * игрушку по дороге — вдали от места захвата и до лотка, — и та падает в кучу.
 */
@injectable()
export class DeliveringPhase implements Phase<PhaseName> {
  readonly name = PhaseName.delivering

  private readonly rig: ClawRig
  private readonly heap: Heap

  constructor(
    @inject(TOYBOX_TOKENS.ClawRig) rig: ClawRig,
    @inject(TOYBOX_TOKENS.Heap) heap: Heap
  ) {
    this.rig = rig
    this.heap = heap
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.releasing> {
    await this.rig.carryTo(TRAY_CENTER, this.rollFumble(TRAY_CENTER), signal)

    return PhaseName.releasing
  }

  private rollFumble(target: GroundPoint): ClawDrop | undefined {
    if (!this.heap.isHolding || Math.random() >= FUMBLE_CHANCE) return undefined

    const share = pickFumbleShare(this.rig.getCartPoint(), target, Math.random)

    if (share === undefined) return undefined

    return {
      share,
      onDrop: (grip) => {
        this.heap.release(grip)
      },
    }
  }
}
