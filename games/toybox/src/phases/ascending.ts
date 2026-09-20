import { inject, injectable } from 'inversify'

import { LIFT_FUMBLE_CHANCE, LIFT_SLIP_MAX_SHARE, LIFT_SLIP_MIN_SHARE, PHASE_PAUSE_MS } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { ContentsController } from '#src/controllers/box/contents'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { type ClawSlip, PhaseName } from '#src/types'
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
  private readonly claw: ClawController
  private readonly contents: ContentsController
  private readonly toyboxStore: ToyboxStore

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOYBOX_TOKENS.ClawController) claw: ClawController,
    @inject(TOYBOX_TOKENS.ContentsController) contents: ContentsController,
    @inject(TOYBOX_TOKENS.ToyboxStore) toyboxStore: ToyboxStore
  ) {
    this.ticker = ticker
    this.claw = claw
    this.contents = contents
    this.toyboxStore = toyboxStore
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.delivering> {
    const lifted = this.claw.isHolding()

    await this.claw.ascend(this.rollSlip(), signal)

    if (lifted) this.contents.settle()

    await this.ticker.waitTicks(PHASE_PAUSE_MS, signal)

    return PhaseName.delivering
  }

  /** Бросок на срыв: вторым броском выбирается доля подъёма, на которой клешня разжимается. */
  private rollSlip(): ClawSlip | undefined {
    if (!this.claw.isHolding() || Math.random() >= LIFT_FUMBLE_CHANCE) return undefined

    const cell = this.claw.getCell()
    const share = LIFT_SLIP_MIN_SHARE + Math.random() * (LIFT_SLIP_MAX_SHARE - LIFT_SLIP_MIN_SHARE)

    return {
      share,
      onDrop: (toy) => {
        if (this.contents.drop(toy, cell)) this.toyboxStore.collect()
      },
    }
  }
}
