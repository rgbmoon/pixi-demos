import { inject, injectable } from 'inversify'
import type { GameEmitter } from 'src/core/events/game-emitter'
import { ReelsMachine } from 'src/core/reels/reels-machine'
import type { CellIndex } from 'src/core/reels/types'
import type { GameTicker } from 'src/engine/game-ticker'
import { LiveContainer } from 'src/engine/live-container'
import type { SpinePool } from 'src/engine/spine-pool'
import { ENGINE_TOKENS } from 'src/engine/tokens'
import { tweenAlpha } from 'src/engine/utils'
import { HOLD_WIN_SWAP_MS } from 'src/games/slot/constants'
import type { GameEvents } from 'src/games/slot/events'
import { SLOT_REELS, SLOT_STRATEGIES, SLOT_TURBO_STRATEGIES, type SlotReelsData } from 'src/games/slot/reels'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import type { SymbolKey } from 'src/games/slot/types'
import { AnticipationGlowFrame } from 'src/games/slot/ui/reels/anticipation-glow-frame'
import { ReelsBoard } from 'src/games/slot/ui/reels/reels-board'

import { CascadeMultiplierController } from './cascade-multiplier'
import { HeldFrameController } from './held-frame'
import { PaylinesController } from './paylines'
import { WinOverlayController } from './win-overlay'

/**
 * Машина барабанов: держит модель лент и её поле, наполняет доску стартовыми символами по стору,
 * переключает стратегии движения по турбо-режиму и открывает фазам методы раунда — прокрутку, посадку,
 * каскад и показ выигрыша.
 */
@injectable()
export class ReelsMachineController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly emitter: GameEmitter<GameEvents>
  private readonly machine: ReelsMachine<SlotReelsData, SymbolKey>
  private readonly board: ReelsBoard
  private readonly anticipationGlowFrame: AnticipationGlowFrame
  private readonly heldFrame: HeldFrameController
  private readonly paylines: PaylinesController
  private readonly winOverlay: WinOverlayController
  private readonly cascadeMultiplier: CascadeMultiplierController

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(ENGINE_TOKENS.SpinePool) pool: SpinePool,
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore,
    @inject(SLOT_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>
  ) {
    super()

    this.ticker = ticker
    this.emitter = emitter

    this.machine = new ReelsMachine(SLOT_REELS)
    this.board = new ReelsBoard(ticker, this.machine, pool)

    this.anticipationGlowFrame = new AnticipationGlowFrame(ticker)
    this.heldFrame = new HeldFrameController(ticker, slotStore)
    this.paylines = new PaylinesController(ticker, slotStore)
    this.winOverlay = new WinOverlayController(ticker, slotStore, this.paylines)
    this.cascadeMultiplier = new CascadeMultiplierController(ticker, slotStore)

    this.board.addOverlay(this.anticipationGlowFrame)
    this.board.addOverlay(this.heldFrame)
    this.board.addOverlay(this.winOverlay)
    // После вин оверлея: линия пересекает поднятый выигравший символ и должна идти поверх него
    this.board.addOverlay(this.paylines)
    this.board.addOverlay(this.cascadeMultiplier)

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

  /** Запускает прокрутку; барабаны из `held` остаются на месте до конца раунда. */
  spin(held: readonly number[] = []): void {
    this.machine.spin({ held })
  }

  /**
   * Сажает барабаны на символы раунда; барабаны из `anticipation` садятся с паузой.
   * `stopSignal` проматывает посадку к финалу: сработавший до вызова — с первого кадра, сработавший
   * по ходу — с момента срабатывания. Каждый вставший барабан объявляется событием `reel:landed`,
   * начало паузы — `reel:anticipationStarted`.
   */
  async land(
    symbolKeys: SlotReelsData | undefined,
    anticipation: readonly number[],
    signal?: AbortSignal,
    stopSignal?: AbortSignal
  ): Promise<void> {
    this.machine.setData(symbolKeys ?? null)

    const landing = this.machine.land({
      signal,
      anticipation,
      onReelLanded: this.handleReelLanded,
      onReelAnticipated: this.handleReelAnticipated,
    })

    if (stopSignal?.aborted) {
      this.machine.slam()
    }

    stopSignal?.addEventListener('abort', this.slam, { once: true })

    try {
      await landing
    } finally {
      stopSignal?.removeEventListener('abort', this.slam)
      this.anticipationGlowFrame.hideAll()
    }
  }

  /** Взрывает символы в ячейках `removed`; ячейки остаются пустыми до падения каскада. */
  async explode(removed: readonly CellIndex[], signal?: AbortSignal): Promise<void> {
    const symbols = removed.flatMap((cell) => this.board.getCellView(cell) ?? [])

    await Promise.all(symbols.map((symbol) => symbol.explode(signal)))
  }

  /**
   * Сажает каскад на символы шага: уцелевшие символы падают на освободившиеся ячейки, новые — сверху.
   * `stopSignal` проматывает падение так же, как посадку. Каждый вставший барабан объявляется `reel:landed`.
   */
  async cascade(
    symbolKeys: SlotReelsData,
    removed: readonly CellIndex[],
    signal?: AbortSignal,
    stopSignal?: AbortSignal
  ): Promise<void> {
    // View взорванных ячеек берутся до каскада: модель переставит слоты, и адрес укажет на другой символ
    const exploded = removed.flatMap((cell) => this.board.getCellView(cell) ?? [])

    this.machine.setData(symbolKeys)

    const falling = this.machine.cascade({ removed, signal, onReelLanded: this.handleReelLanded })

    // Модель уже подняла их слоты над зоной: адаптер перенесёт позиции раньше, чем кадр отрисуется
    exploded.forEach((symbol) => symbol.idle())

    if (stopSignal?.aborted) {
      this.machine.slam()
    }

    stopSignal?.addEventListener('abort', this.slam, { once: true })

    try {
      await falling
    } finally {
      stopSignal?.removeEventListener('abort', this.slam)
    }
  }

  /** Проявляет доску барабанов после бонуса. */
  async show(signal?: AbortSignal): Promise<void> {
    this.visible = true

    await tweenAlpha(this.ticker, this, 1, HOLD_WIN_SWAP_MS, signal)
  }

  /** Гасит доску барабанов на время бонуса; скрытая доска не рисуется и не держит маску. */
  async hide(signal?: AbortSignal): Promise<void> {
    await tweenAlpha(this.ticker, this, 0, HOLD_WIN_SWAP_MS, signal)

    this.visible = false
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

  private handleReelLanded = (reel: number): void => {
    this.anticipationGlowFrame.hide(reel)
    this.emitter.emit('reel:landed', { reel })
  }

  private handleReelAnticipated = (reel: number): void => {
    this.anticipationGlowFrame.show(reel)
    this.emitter.emit('reel:anticipationStarted', { reel })
  }
}
