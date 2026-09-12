import type { GameTicker } from 'src/engine/game-ticker'
import { LiveContainer } from 'src/engine/live-container'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { CascadeMultiplier } from 'src/games/slot/ui/reels/cascade-multiplier'

/** Множитель каскада: переносит множитель шага из стора на кромку поля и гасит его вне каскада. */
export class CascadeMultiplierController extends LiveContainer {
  private readonly multiplier: CascadeMultiplier

  constructor(ticker: GameTicker, slotStore: SlotStore) {
    super()

    this.multiplier = new CascadeMultiplier(ticker)

    this.addChild(this.multiplier)

    this.watch(
      () => slotStore.cascadeMultiplier,
      (multiplier) => {
        if (multiplier === null) this.multiplier.hide()
        else this.multiplier.show(multiplier)
      },
      { fireImmediately: true }
    )
  }
}
