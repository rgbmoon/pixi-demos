import { inject, injectable } from 'inversify'

import type { SlotStore } from '#src/stores/slot'
import { SLOT_TOKENS } from '#src/tokens'
import { Background } from '#src/ui/background'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/**
 * Контроллер фона: стоит первым ребёнком сцены и переключает фон на турбо fade-ом, пока игрок держит спин.
 * Фазам открывает вспышку фона.
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

  flash(signal?: AbortSignal): Promise<void> {
    return this.animation.flash(signal)
  }
}
