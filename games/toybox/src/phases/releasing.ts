import { inject, injectable } from 'inversify'

import { TRAY_HOLD_MS, TRAY_RELEASE_MS } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { Heap } from '#src/heap/heap'
import { TOYBOX_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { Phase } from '@pixi-demos/core/fsm/types'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/** Отпускает доставленную игрушку и ждёт покоя кучи: за это время все игрушки в лотке доходят до дна. */
@injectable()
export class ReleasingPhase implements Phase<PhaseName> {
  readonly name = PhaseName.releasing

  private readonly ticker: GameTicker
  private readonly claw: ClawController
  private readonly heap: Heap

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.ClawController) claw: ClawController,
    @inject(TOYBOX_TOKENS.Heap) heap: Heap
  ) {
    this.ticker = ticker
    this.claw = claw
    this.heap = heap
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.presenting | typeof PhaseName.returning> {
    await this.ticker.waitTicks(this.heap.isHolding ? TRAY_RELEASE_MS : TRAY_HOLD_MS, signal)
    if (this.heap.isHolding) this.heap.dropIntoTray(this.claw.getGripPoint())

    // Призы засчитывает кадровый шаг модели; в покое кучи очередь призов цикла полная
    await this.ticker.waitUntil(() => this.heap.settled, signal)

    return this.heap.prizeCount > 0 ? PhaseName.presenting : PhaseName.returning
  }
}
