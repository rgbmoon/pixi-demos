import { inject, injectable } from 'inversify'
import type { GameTicker } from 'src/engine/game-ticker'
import { LiveContainer } from 'src/engine/live-container'
import type { SpinePool } from 'src/engine/spine-pool'
import { ENGINE_TOKENS } from 'src/engine/tokens'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import type { SymbolKey } from 'src/games/slot/types'
import { ReelsMachine } from 'src/games/slot/ui/reels/reels-machine'

import { PaylinesController } from './paylines'
import { WinOverlayController } from './win-overlay'

/**
 * Машина барабанов: наполняет ленты стартовыми символами по стору и открывает фазам
 * методы раунда — прокрутку, посадку и показ выигрыша.
 */
@injectable()
export class ReelsMachineController extends LiveContainer {
  private readonly machine: ReelsMachine
  private readonly paylines: PaylinesController
  private readonly winOverlay: WinOverlayController

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(ENGINE_TOKENS.SpinePool) pool: SpinePool,
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore
  ) {
    super()

    this.machine = new ReelsMachine(ticker, pool)

    this.paylines = new PaylinesController(ticker, slotStore)
    this.winOverlay = new WinOverlayController(ticker, slotStore, this.paylines)

    this.machine.addOverlay(this.winOverlay)
    // После вин оверлея: линия пересекает поднятый выигравший символ и должна идти поверх него
    this.machine.addOverlay(this.paylines)

    this.addChild(this.machine)

    this.watch(
      () => slotStore.initialSymbols,
      (initialSymbols) => this.setSymbols(initialSymbols),
      {
        fireImmediately: true,
      }
    )
  }

  private setSymbols(symbols: SymbolKey[][] | undefined): void {
    if (!symbols) return

    this.machine.setSymbols(symbols)
  }

  spin(): void {
    this.machine.spin()
  }

  land(symbolKeys: SymbolKey[][] | undefined, signal?: AbortSignal): Promise<void> {
    return this.machine.land(symbolKeys, signal)
  }

  showTint(signal?: AbortSignal): Promise<void> {
    return this.machine.showTint(signal)
  }

  hideTint(signal?: AbortSignal): Promise<void> {
    return this.machine.hideTint(signal)
  }

  showAllWins(signal?: AbortSignal): Promise<void> {
    return this.winOverlay.showAllWins(this.machine.visibleSymbols, signal)
  }

  playWinLines(signal?: AbortSignal): Promise<void> {
    return this.winOverlay.playWinLines(this.machine.visibleSymbols, signal)
  }
}
