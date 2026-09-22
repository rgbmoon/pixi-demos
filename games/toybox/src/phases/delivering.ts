import { inject, injectable } from 'inversify'

import { FUMBLE_CHANCE, TRAY_CENTER } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { PrizeOutputController } from '#src/controllers/box/prize-output'
import type { HeapStore } from '#src/stores/heap'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { type ClawDrop, PhaseName, type ToyAppearance } from '#src/types'
import { pickFumbleCell } from '#src/utils/projection'
import { isAbortError, notifyFatal } from '@pixi-demos/core/errors/utils'
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
  private readonly prizeOutput: PrizeOutputController

  constructor(
    @inject(TOYBOX_TOKENS.ClawController) claw: ClawController,
    @inject(TOYBOX_TOKENS.HeapStore) heap: HeapStore,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore,
    @inject(TOYBOX_TOKENS.PrizeOutputController) prizeOutput: PrizeOutputController
  ) {
    this.claw = claw
    this.heap = heap
    this.toyboxStore = toyboxStore
    this.prizeOutput = prizeOutput
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
        this.heap.release(id, cell, (appearance) => this.collect(appearance))
      },
    }
  }

  private collect(appearance: ToyAppearance): void {
    const collected = this.toyboxStore.recordCollection()

    this.toyboxStore.beginPrize()
    void this.present(appearance, collected)
  }

  private async present(appearance: ToyAppearance, collected: number): Promise<void> {
    try {
      await this.prizeOutput.present(appearance, collected)
    } catch (error) {
      if (!isAbortError(error)) notifyFatal(error, 'Prize presentation failed')
    } finally {
      this.toyboxStore.finishPrize()
    }
  }
}
