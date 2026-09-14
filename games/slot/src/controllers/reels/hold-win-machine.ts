import { inject, injectable } from 'inversify'

import { HOLD_WIN_COLLECT_HOLD_MS, HOLD_WIN_SWAP_MS } from '#src/constants'
import type { GameEvents } from '#src/events'
import { HOLD_WIN_REELS, HOLD_WIN_STRATEGIES, HOLD_WIN_TURBO_STRATEGIES } from '#src/reels'
import type { SlotStore } from '#src/stores/slot'
import { SLOT_TOKENS } from '#src/tokens'
import type { CoinValue, HoldWinCell } from '#src/types'
import { HoldWinBoard } from '#src/ui/reels/hold-win-board'
import { formatAmount, toHoldWinCell, toHoldWinReel, toHoldWinReelsData } from '#src/utils'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'
import type { SpinePool } from '@pixi-demos/engine/spine-pool'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'
import { tweenAlpha } from '@pixi-demos/engine/utils'
import type { CellIndex } from '@pixi-demos/reels'
import { ReelsMachine } from '@pixi-demos/reels'

/**
 * Контроллер рил-машины Hold & Win: создаёт машину ячеек и доску, меняет стратегии по турбо-режиму. Фазам
 * даёт методы бонуса: показ доски, прокрутку незанятых ячеек, посадку, промотку и сбор монет.
 */
@injectable()
export class HoldWinMachineController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly slotStore: SlotStore
  private readonly emitter: GameEmitter<GameEvents>
  private readonly machine: ReelsMachine<HoldWinCell>
  private readonly board: HoldWinBoard
  /** Индексы барабанов, где стоит монета: их рамки подсвечены. */
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
  async show(frame: CoinValue[][] | undefined, signal?: AbortSignal): Promise<void> {
    this.machine.setData(frame ? toHoldWinReelsData(frame) : null)
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
   * Сажает крутящиеся ячейки на поле шага. Остановка ячейки объявляется `holdWin:cellLanded`, ячейка с
   * монетой получает подсвеченную рамку.
   */
  async land(frame: CoinValue[][], signal?: AbortSignal): Promise<void> {
    this.machine.setData(toHoldWinReelsData(frame))

    await this.machine.land({ signal, onReelLanded: this.handleCellLanded })
  }

  /** Проматывает посадку ячеек; нажатая до посадки промотка применяется при её старте. */
  slam(): void {
    this.machine.slam()
  }

  /**
   * Собирает монеты поля: переводит их в выигрышную позу по порядку барабанов с интервалом `staggerMs` и
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

    this.emitter.emit('holdWin:cellLanded', {
      ...toHoldWinCell(index),
      value: typeof value === 'number' ? value : null,
    })
  }
}
