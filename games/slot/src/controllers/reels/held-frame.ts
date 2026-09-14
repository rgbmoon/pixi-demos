import type { SlotStore } from '#src/stores/slot'
import { HeldFrame } from '#src/ui/reels/held-frame'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'

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
