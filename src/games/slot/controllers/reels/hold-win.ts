import { inject, injectable } from 'inversify'
import type { GameEmitter } from 'src/core/events/game-emitter'
import { ReelsMachine } from 'src/core/reels/reels-machine'
import type { CellIndex } from 'src/core/reels/types'
import type { GameTicker } from 'src/engine/game-ticker'
import { LiveContainer } from 'src/engine/live-container'
import type { SpinePool } from 'src/engine/spine-pool'
import { ENGINE_TOKENS } from 'src/engine/tokens'
import { tweenAlpha } from 'src/engine/utils'
import { HOLD_WIN_COLLECT_HOLD_MS, HOLD_WIN_COLLECT_STAGGER_MS, HOLD_WIN_SWAP_MS } from 'src/games/slot/constants'
import type { GameEvents } from 'src/games/slot/events'
import {
  HOLD_WIN_REELS,
  HOLD_WIN_STRATEGIES,
  HOLD_WIN_TURBO_STRATEGIES,
  type HoldWinReelsData,
} from 'src/games/slot/reels'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import type { HoldWinCell } from 'src/games/slot/types'
import type { Coin } from 'src/games/slot/ui/reels/coin'
import { HoldWinBoard } from 'src/games/slot/ui/reels/hold-win-board'
import { formatAmount, toHoldWinCell, toHoldWinReel } from 'src/games/slot/utils'

/**
 * Поле бонуса Hold & Win: держит машину ячеек и её доску, переключает стратегии по турбо-режиму и
 * открывает фазам методы бонуса — появление доски, прокрутку незанятых ячеек, посадку и сбор монет.
 */
@injectable()
export class HoldWinController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly slotStore: SlotStore
  private readonly emitter: GameEmitter<GameEvents>
  private readonly machine: ReelsMachine<HoldWinReelsData, HoldWinCell>
  private readonly board: HoldWinBoard
  /** Индексы лент, где стоит монета: их рамки подсвечены. */
  private readonly coinCells = new Set<number>()

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(ENGINE_TOKENS.SpinePool) pool: SpinePool,
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore,
    @inject(SLOT_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>
  ) {
    super()

    this.ticker = ticker
    this.slotStore = slotStore
    this.emitter = emitter

    this.machine = new ReelsMachine(HOLD_WIN_REELS)
    this.board = new HoldWinBoard(ticker, this.machine, pool)

    this.addChild(this.board)

    // Доска создаётся скрытой: её проявляет фаза бонуса
    this.alpha = 0
    this.visible = false

    this.watch(
      () => slotStore.isTurboEnabled,
      (isTurbo) => this.machine.setStrategies(isTurbo ? HOLD_WIN_TURBO_STRATEGIES : HOLD_WIN_STRATEGIES),
      { fireImmediately: true }
    )
  }

  /** Ставит ячейки на стартовое поле бонуса, подсвечивает стартовые монеты и проявляет доску. */
  async show(frame: HoldWinReelsData | undefined, signal?: AbortSignal): Promise<void> {
    this.machine.setData(frame ?? null)
    this.machine.reset()

    this.coinCells.clear()
    this.machine.getReels().forEach((reel) => {
      if (typeof reel.getCell(0)?.getValue() === 'number') this.coinCells.add(reel.index)
    })
    this.board.setCoinCells([...this.coinCells])

    this.visible = true

    await tweenAlpha(this.ticker, this, 1, HOLD_WIN_SWAP_MS, signal)
  }

  /** Гасит доску; скрытая доска не рисуется и не держит маски. */
  async hide(signal?: AbortSignal): Promise<void> {
    await tweenAlpha(this.ticker, this, 0, HOLD_WIN_SWAP_MS, signal)

    this.visible = false
    this.board.hideGrand()
    this.board.setCoinCells([])
  }

  /** Запускает прокрутку ячеек; ячейки из `held` остаются на месте. */
  spin(held: readonly CellIndex[]): void {
    this.machine.spin({ held: held.map(toHoldWinReel) })
  }

  /**
   * Сажает крутящиеся ячейки на поле шага. `stopSignal` проматывает посадку к финалу так же, как у
   * барабанов. Каждая вставшая ячейка объявляется событием `holdWin:cellLanded`, вставшая монета
   * получает подсвеченную рамку.
   */
  async land(frame: HoldWinReelsData, signal?: AbortSignal, stopSignal?: AbortSignal): Promise<void> {
    this.machine.setData(frame)

    const landing = this.machine.land({ signal, onReelLanded: this.handleCellLanded })

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

  /**
   * Собирает монеты поля: поднимает их в выигрышную позу по порядку лент, в турбо — разом, и держит
   * позу до конца показа. Полное поле объявляется надписью Grand с выплатой из ответа.
   */
  async collect(signal?: AbortSignal): Promise<void> {
    const { isTurboEnabled, spinHoldWin } = this.slotStore
    const coins = this.board.getCoins().filter((coin): coin is Coin => coin !== undefined && coin.getValue() > 0)

    try {
      for (const coin of coins) {
        coin.win()

        if (!isTurboEnabled) await this.ticker.waitTicks(HOLD_WIN_COLLECT_STAGGER_MS, signal)
      }

      if (spinHoldWin && spinHoldWin.grand > 0) {
        this.board.showGrand(formatAmount(spinHoldWin.grand))
      }

      await this.ticker.waitTicks(HOLD_WIN_COLLECT_HOLD_MS, signal)
    } finally {
      coins.forEach((coin) => coin.idle())
    }
  }

  private slam = (): void => {
    this.machine.slam()
  }

  private handleCellLanded = (index: number): void => {
    const value = this.machine.getCell({ reel: index, row: 0 })?.getValue()

    if (typeof value === 'number') {
      this.coinCells.add(index)
      this.board.setCoinCells([...this.coinCells])
    }

    this.emitter.emit('holdWin:cellLanded', { ...toHoldWinCell(index), value: typeof value === 'number' ? value : null })
  }
}
