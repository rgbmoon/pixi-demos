import { inject, injectable } from 'inversify'
import type { GameEmitter } from 'src/core/events/game-emitter'
import { ReelsMachine } from 'src/core/reels/reels-machine'
import type { GameTicker } from 'src/engine/game-ticker'
import { LiveContainer } from 'src/engine/live-container'
import type { SpinePool } from 'src/engine/spine-pool'
import { ENGINE_TOKENS } from 'src/engine/tokens'
import type { GameEvents } from 'src/games/slot/events'
import { SLOT_REELS, SLOT_STRATEGIES, SLOT_TURBO_STRATEGIES, type SlotReelsData } from 'src/games/slot/reels'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import type { SymbolKey } from 'src/games/slot/types'
import { ReelsBoard } from 'src/games/slot/ui/reels/reels-board'

import { PaylinesController } from './paylines'
import { WinOverlayController } from './win-overlay'

/**
 * Машина барабанов: держит модель лент и её поле, наполняет доску стартовыми символами по стору,
 * переключает стратегии движения по турбо-режиму и открывает фазам методы раунда — прокрутку, посадку и показ выигрыша.
 */
@injectable()
export class ReelsMachineController extends LiveContainer {
  private readonly emitter: GameEmitter<GameEvents>
  private readonly machine: ReelsMachine<SlotReelsData, SymbolKey>
  private readonly board: ReelsBoard
  private readonly paylines: PaylinesController
  private readonly winOverlay: WinOverlayController

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(ENGINE_TOKENS.SpinePool) pool: SpinePool,
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore,
    @inject(SLOT_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>
  ) {
    super()

    this.emitter = emitter

    this.machine = new ReelsMachine(SLOT_REELS)
    this.board = new ReelsBoard(ticker, this.machine, pool)

    this.paylines = new PaylinesController(ticker, slotStore)
    this.winOverlay = new WinOverlayController(ticker, slotStore, this.paylines)

    this.board.addOverlay(this.winOverlay)
    // После вин оверлея: линия пересекает поднятый выигравший символ и должна идти поверх него
    this.board.addOverlay(this.paylines)

    this.addChild(this.board)

    this.watch(
      () => slotStore.initialSymbols,
      (initialSymbols) => this.setSymbols(initialSymbols),
      {
        fireImmediately: true,
      }
    )

    this.watch(
      () => slotStore.isTurboEnabled,
      (isTurbo) => this.machine.setStrategies(isTurbo ? SLOT_TURBO_STRATEGIES : SLOT_STRATEGIES),
      { fireImmediately: true }
    )
  }

  private setSymbols(symbols: SlotReelsData | undefined): void {
    if (!symbols) return

    this.machine.setData(symbols)
    this.machine.reset()
  }

  spin(): void {
    this.machine.spin()
  }

  /**
   * Сажает барабаны на символы раунда. `stopSignal` проматывает посадку к финалу: сработавший
   * до вызова — с первого кадра, сработавший по ходу — с момента срабатывания.
   * Каждый вставший барабан объявляется событием `reel:landed`.
   */
  async land(symbolKeys: SlotReelsData | undefined, signal?: AbortSignal, stopSignal?: AbortSignal): Promise<void> {
    this.machine.setData(symbolKeys ?? null)

    const landing = this.machine.land(signal, this.announceReelLanded)

    if (stopSignal?.aborted) {
      this.machine.slam()
    }

    stopSignal?.addEventListener('abort', this.slam, { once: true })

    try {
      await landing
    } finally {
      stopSignal?.removeEventListener('abort', this.slam)
    }
  }

  showTint(signal?: AbortSignal): Promise<void> {
    return this.board.showTint(signal)
  }

  hideTint(signal?: AbortSignal): Promise<void> {
    return this.board.hideTint(signal)
  }

  showAllWins(signal?: AbortSignal, durationMs?: number): Promise<void> {
    return this.winOverlay.showAllWins(this.board.getGridViews(), signal, durationMs)
  }

  playWinLines(signal?: AbortSignal): Promise<void> {
    return this.winOverlay.playWinLines(this.board.getGridViews(), signal)
  }

  private slam = (): void => {
    this.machine.slam()
  }

  private announceReelLanded = (reel: number): void => {
    this.emitter.emit('reel:landed', { reel })
  }
}
