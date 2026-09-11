import { inject, injectable } from 'inversify'
import type { GameTicker } from 'src/engine/game-ticker'
import { LiveContainer } from 'src/engine/live-container'
import { ENGINE_TOKENS } from 'src/engine/tokens'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { Background } from 'src/games/slot/ui/background'

/**
 * Контроллер фона: стоит первым ребёнком сцены и переключает фон на турбо fade-ом, пока игрок держит спин.
 */
@injectable()
export class BackgroundController extends LiveContainer {
  private readonly animation: Background

  constructor(@inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker, @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore) {
    super()

    this.animation = new Background(ticker, slotStore.isSpinHeld)
    this.addChild(this.animation)

    this.watch(
      () => slotStore.isSpinHeld,
      (isTurbo) => this.animation.fadeTo(isTurbo)
    )
  }
}
