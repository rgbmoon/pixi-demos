import { inject, injectable } from 'inversify'

import { FUMBLE_CHANCE, TRAY_CENTER } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { HeapStore } from '#src/stores/heap'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { type ClawDrop, PhaseName } from '#src/types'
import { pickFumbleCell } from '#src/utils/projection'
import type { Phase } from '@pixi-demos/core/fsm/types'

/**
 * Фаза доставки: клешня одним ходом движется к лотку. С вероятностью `FUMBLE_CHANCE` она
 * роняет игрушку над ячейкой по дороге, и та возвращается в кучу.
 */
@injectable()
export class DeliveringPhase implements Phase<PhaseName> {
  readonly name = PhaseName.delivering

  private readonly claw: ClawController
  private readonly heap: HeapStore
  private readonly toyboxStore: ToyboxStore

  constructor(
    @inject(TOYBOX_TOKENS.ClawController) claw: ClawController,
    @inject(TOYBOX_TOKENS.HeapStore) heap: HeapStore,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore
  ) {
    this.claw = claw
    this.heap = heap
    this.toyboxStore = toyboxStore
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.releasing> {
    await this.claw.carryTo(TRAY_CENTER, this.rollFumble(), signal)

    return PhaseName.releasing
  }

  private rollFumble(): ClawDrop | undefined {
    if (!this.claw.isHolding() || Math.random() >= FUMBLE_CHANCE) return undefined

    const cell = pickFumbleCell(this.claw.getPosition(), TRAY_CENTER, Math.random)

    if (!cell) return undefined

    return {
      cell,
      onDrop: (id) => {
        this.heap.release(id, cell, () => this.toyboxStore.recordCollection())
      },
    }
  }
}
