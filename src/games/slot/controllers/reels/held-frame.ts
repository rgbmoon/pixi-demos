import type { GameTicker } from 'src/engine/game-ticker'
import { LiveContainer } from 'src/engine/live-container'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { HeldFrame } from 'src/games/slot/ui/reels/held-frame'

/** Подсветка удержанных барабанов: переносит список удержанных из стора в колонки подсветки. */
export class HeldFrameController extends LiveContainer {
  private readonly frame: HeldFrame

  constructor(ticker: GameTicker, slotStore: SlotStore) {
    super()

    this.frame = new HeldFrame(ticker)

    this.addChild(this.frame)

    this.watch(
      () => slotStore.heldReels,
      (heldReels) => this.frame.setHeld(heldReels),
      { fireImmediately: true }
    )
  }
}
