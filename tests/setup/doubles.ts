import { ReelsMachine } from 'src/core/reels/reels-machine'
import type { CellIndex } from 'src/core/reels/types'
import type { GameTicker } from 'src/engine/game-ticker'
import type { BackgroundController } from 'src/games/slot/controllers/background'
import type { HoldWinController } from 'src/games/slot/controllers/reels/hold-win'
import type { ReelsMachineController } from 'src/games/slot/controllers/reels/reels-machine'
import { HOLD_WIN_REELS, type HoldWinReelsData, type SlotReelsData } from 'src/games/slot/reels'
import type { HoldWinCell } from 'src/games/slot/types'
import { toHoldWinCell, toHoldWinReel } from 'src/games/slot/utils'

import { advanceUntilIdle, createMachine, readVisibleGrid } from './reels'

/** Журнал вызовов презентации в порядке их появления. */
export type PresentationLog = string[]

export type ReelsStub = {
  /** Видимая сетка модели: чем барабаны кончили раунд. */
  readGrid: () => (string | undefined)[][]
}

/**
 * Дублёр контроллера барабанов поверх настоящей модели: `land` действительно прокручивает
 * ленты и сажает их на данные раунда, только синхронно и без рендера. Прокрутка с удержанными
 * барабанами отмечается в журнале как `respin`. Сработавший `stopSignal`
 * проматывает посадку настоящим `slam` и отмечается в журнале.
 * Методы презентации резолвятся сразу и отмечаются в журнале.
 */
export const createReelsStub = (log: PresentationLog): ReelsMachineController & ReelsStub => {
  const machine = createMachine()

  const stub = {
    spin: (held: readonly number[] = []) => {
      log.push(held.length > 0 ? 'respin' : 'spin')
      machine.spin({ held })
    },
    land: async (
      symbolKeys: SlotReelsData | undefined,
      anticipation: readonly number[],
      _signal?: AbortSignal,
      stopSignal?: AbortSignal
    ) => {
      machine.setData((symbolKeys ?? null) as never)

      const landing = machine.land({ anticipation })

      // Посадка дублёра синхронна: Stop успевает сработать только до её начала
      if (stopSignal?.aborted) {
        machine.slam()
        log.push('slam')
      }

      advanceUntilIdle(machine)
      await landing

      log.push('land')
    },
    showTint: async () => {
      log.push('showTint')
    },
    hideTint: async () => {
      log.push('hideTint')
    },
    showAllWins: async () => {
      log.push('showAllWins')
    },
    playWinLines: async () => {
      log.push('playWinLines')
    },
    show: async () => {
      log.push('showReels')
    },
    hide: async () => {
      log.push('hideReels')
    },
    readGrid: () => readVisibleGrid(machine),
  }

  // Фазы видят контроллер только как тип и зовут ровно эти методы; остального PIXI-наследия им не нужно
  return stub as unknown as ReelsMachineController & ReelsStub
}

export type HoldWinStub = {
  /** Видимое поле бонуса `[барабан][ряд]`: чем ячейки кончили последний шаг. */
  readGrid: () => HoldWinCell[][]
}

/**
 * Дублёр контроллера бонуса поверх настоящей машины ячеек: `land` синхронно прокручивает ленты
 * и сажает их на поле шага. Удержанные ячейки не крутятся. Сработавший `stopSignal` проматывает
 * посадку настоящим `slam` и отмечается в журнале как `holdWinSlam`.
 */
export const createHoldWinStub = (log: PresentationLog): HoldWinController & HoldWinStub => {
  const machine = new ReelsMachine(HOLD_WIN_REELS)

  const stub = {
    show: async (frame: HoldWinReelsData | undefined) => {
      log.push('showHoldWin')
      machine.setData(frame ?? null)
      machine.reset()
    },
    hide: async () => {
      log.push('hideHoldWin')
    },
    spin: (held: readonly CellIndex[]) => {
      log.push('holdWinSpin')
      machine.spin({ held: held.map(toHoldWinReel) })
    },
    land: async (frame: HoldWinReelsData, _signal?: AbortSignal, stopSignal?: AbortSignal) => {
      machine.setData(frame)

      const landing = machine.land()

      if (stopSignal?.aborted) {
        machine.slam()
        log.push('holdWinSlam')
      }

      advanceUntilIdle(machine)
      await landing

      log.push('holdWinLand')
    },
    collect: async () => {
      log.push('holdWinCollect')
    },
    readGrid: () => {
      const grid: HoldWinCell[][] = []

      machine.getReels().forEach((reel, index) => {
        const { reel: column, row } = toHoldWinCell(index)

        grid[column] ??= []
        grid[column][row] = reel.getCell(0)?.getSlot()?.value ?? null
      })

      return grid
    },
  }

  return stub as unknown as HoldWinController & HoldWinStub
}

/** Дублёр фона: вспышка резолвится сразу и отмечается в журнале. */
export const createBackgroundStub = (log: PresentationLog): BackgroundController => {
  const stub = {
    flash: async () => {
      log.push('flash')
    },
  }

  return stub as unknown as BackgroundController
}

/** Дублёр тикера: игровые паузы проходят мгновенно, но остаются видимыми в журнале. */
export const createTickerStub = (log: PresentationLog): GameTicker => {
  const stub = {
    waitTicks: async () => {
      log.push('waitTicks')
    },
  }

  return stub as unknown as GameTicker
}
