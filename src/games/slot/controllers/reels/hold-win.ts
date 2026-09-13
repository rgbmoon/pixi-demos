import { inject, injectable } from 'inversify'
import type { GameEmitter } from 'src/core/events/game-emitter'
import { ReelsMachine } from 'src/core/reels/reels-machine'
import type { CellIndex } from 'src/core/reels/types'
import type { GameTicker } from 'src/engine/game-ticker'
import { LiveContainer } from 'src/engine/live-container'
import type { SpinePool } from 'src/engine/spine-pool'
import { ENGINE_TOKENS } from 'src/engine/tokens'
import { tweenAlpha } from 'src/engine/utils'
import { HOLD_WIN_COLLECT_HOLD_MS, HOLD_WIN_SWAP_MS } from 'src/games/slot/constants'
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
import { HoldWinBoard } from 'src/games/slot/ui/reels/hold-win-board'
import { formatAmount, toHoldWinCell, toHoldWinReel } from 'src/games/slot/utils'

/**
 * Контроллер поля Hold & Win: создаёт машину ячеек и доску, меняет стратегии по турбо-режиму. Фазам даёт
 * методы бонуса: показ доски, прокрутку незанятых ячеек, посадку и сбор монет.
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

  /** Гасит доску; скрытая доска не рисуется, её маски тоже. */
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
   * Сажает крутящиеся ячейки на поле шага; `stopSignal` уходит в машину как `slamSignal`. Остановка ячейки
   * объявляется `holdWin:cellLanded`, ячейка с монетой получает подсвеченную рамку.
   */
  async land(frame: HoldWinReelsData, signal?: AbortSignal, stopSignal?: AbortSignal): Promise<void> {
    this.machine.setData(frame)

    await this.machine.land({ signal, slamSignal: stopSignal, onReelLanded: this.handleCellLanded })
  }

  /**
   * Собирает монеты поля: переводит их в выигрышную позу по порядку лент с интервалом `staggerMs` и
   * оставляет в ней до конца показа. Полное поле объявляется надписью Grand с выплатой из ответа.
   */
  async collect(staggerMs: number, signal?: AbortSignal): Promise<void> {
    const { spinHoldWin } = this.slotStore
    const coins = this.machine.getReels().flatMap((reel) => {
      const value = reel.getCell(0)?.getValue()
      const coin = this.board.getCoin(reel.index)

      return typeof value === 'number' && value > 0 && coin ? [coin] : []
    })

    try {
      for (const coin of coins) {
        coin.win()

        if (staggerMs > 0) await this.ticker.waitTicks(staggerMs, signal)
      }

      if (spinHoldWin && spinHoldWin.grand > 0) {
        this.board.showGrand(formatAmount(spinHoldWin.grand))
      }

      await this.ticker.waitTicks(HOLD_WIN_COLLECT_HOLD_MS, signal)
    } finally {
      coins.forEach((coin) => coin.idle())
    }
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
