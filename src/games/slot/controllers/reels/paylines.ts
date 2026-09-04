import type { GameTicker } from 'src/engine/game-ticker'
import { LiveContainer } from 'src/engine/live-container'
import { PAYLINE_PREVIEW_MS } from 'src/games/slot/constants'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { Paylines } from 'src/games/slot/ui/reels/paylines'
import { getActiveLineIds } from 'src/games/slot/utils'


/**
 * Линии выплат: показывает набор по требованию раунда, а на смену режима вне раунда
 * сам проигрывает превью активных линий.
 */
export class PaylinesController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly slotStore: SlotStore
  private readonly paylines = new Paylines()
  private previewAbort?: AbortController

  constructor(ticker: GameTicker, slotStore: SlotStore) {
    super()

    this.ticker = ticker
    this.slotStore = slotStore

    this.addChild(this.paylines)

    this.watch(
      () => slotStore.gameMode,
      () => void this.preview()
    )

    this.watch(
      () => slotStore.isIdle,
      (isIdle) => {
        if (isIdle) return

        this.cancelPreview()
        this.hide()
      }
    )
  }

  /** Показывает переданные линии, остальные гасит. */
  show(lineIds: string[]): void {
    if (this.destroyed) return

    this.paylines.show(lineIds)
  }

  hide(): void {
    if (this.destroyed) return

    this.paylines.hide()
  }

  /** Показ линий режима на `PAYLINE_PREVIEW_MS`; следующее нажатие рисует новый набор, не дожидаясь конца показа. */
  private async preview(): Promise<void> {
    this.cancelPreview()

    const abort = new AbortController()

    this.previewAbort = abort

    this.show(getActiveLineIds(this.slotStore.lines))

    try {
      await this.ticker.waitTicks(PAYLINE_PREVIEW_MS, abort.signal)

      this.hide()
    } catch {
      // Показ прерван следующим нажатием: линии уже перерисованы его вызовом show
    } finally {
      // Отклонение промиса приходит после того, как новый показ записал свой контроллер, — чужой не затираем
      if (this.previewAbort === abort) this.previewAbort = undefined
    }
  }

  private cancelPreview(): void {
    this.previewAbort?.abort()
    this.previewAbort = undefined
  }
}
