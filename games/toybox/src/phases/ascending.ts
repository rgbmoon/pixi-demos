import { inject, injectable } from 'inversify'

import type { ClawRig } from '#src/claw/claw-rig'
import { LIFT_FUMBLE_CHANCE, LIFT_SLIP_MAX_SHARE, LIFT_SLIP_MIN_SHARE, PHASE_PAUSE_MS } from '#src/constants'
import type { Heap } from '#src/heap/heap'
import { TOYBOX_TOKENS } from '#src/tokens'
import { type ClawDrop, PhaseName } from '#src/types'
import type { Phase } from '@pixi-demos/core/fsm/types'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/**
 * Фаза подъёма: клешня возвращается к верхней грани с тем, что смогла захватить. С вероятностью
 * `LIFT_FUMBLE_CHANCE` игрушка выскальзывает по дороге вверх и падает обратно в кучу.
 */
@injectable()
export class AscendingPhase implements Phase<PhaseName> {
  readonly name = PhaseName.ascending

  private readonly ticker: GameTicker
  private readonly rig: ClawRig
  private readonly heap: Heap

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.ClawRig) rig: ClawRig,
    @inject(TOYBOX_TOKENS.Heap) heap: Heap
  ) {
    this.ticker = ticker
    this.rig = rig
    this.heap = heap
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.delivering> {
    await this.rig.ascend(this.rollSlip(), signal)
    await this.ticker.waitTicks(PHASE_PAUSE_MS, signal)

    return PhaseName.delivering
  }

  /** Бросок на срыв: вторым броском выбирается доля подъёма, на которой клешня разжимается. */
  private rollSlip(): ClawDrop | undefined {
    if (!this.heap.isHolding || Math.random() >= LIFT_FUMBLE_CHANCE) return undefined

    const share = LIFT_SLIP_MIN_SHARE + Math.random() * (LIFT_SLIP_MAX_SHARE - LIFT_SLIP_MIN_SHARE)

    return {
      share,
      onDrop: (grip) => {
        this.heap.release(grip)
      },
    }
  }
}
