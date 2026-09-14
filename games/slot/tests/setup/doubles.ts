import type { BackgroundController } from '#src/controllers/background'
import type { HoldWinMachineController } from '#src/controllers/reels/hold-win-machine'
import type { ReelsMachineController } from '#src/controllers/reels/reels-machine'
import { HOLD_WIN_REELS, type SlotReelsData } from '#src/reels'
import type { CoinValue, HoldWinCell } from '#src/types'
import { toHoldWinCell, toHoldWinReel, toHoldWinReelsData } from '#src/utils'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { ReelsMachine } from '@pixi-demos/reels'
import type { CellIndex } from '@pixi-demos/reels'
import { advanceUntilIdle, createMachine, readVisibleGrid } from '@pixi-demos/reels/tests/setup/reels'

/** Журнал вызовов презентации в порядке их появления. */
export type PresentationLog = string[]

export type ReelsMachineStub = {
  /** Видимая сетка модели: чем барабаны кончили раунд. */
  readGrid: () => (string | undefined)[][]
  /** Барабаны, которые последняя посадка получила в anticipation. */
  readAnticipation: () => readonly number[]
}

/**
 * Дублёр контроллера рил-машины барабанов поверх настоящей модели: `land` и `cascade` действительно
 * двигают барабаны и сажают их на данные раунда, только синхронно и без рендера. Прокрутка с удержанными
 * барабанами отмечается в журнале как `respin`. `slam` уходит в модель, а промотка отмечается в журнале
 * в момент, когда её применяет посадка или падение.
 * Методы презентации резолвятся сразу и отмечаются в журнале.
 */
export const createReelsMachineStub = (log: PresentationLog): ReelsMachineController & ReelsMachineStub => {
  const machine = createMachine()
  let lastAnticipation: readonly number[] = []
  let isSlamRequested = false

  const stub = {
    spin: (held: readonly number[] = []) => {
      log.push(held.length > 0 ? 'respin' : 'spin')
      machine.spin({ held })
    },
    land: async (symbolKeys: SlotReelsData | undefined, anticipation: readonly number[]) => {
      machine.setData(symbolKeys ?? null)
      lastAnticipation = anticipation

      const landing = machine.land({ anticipation })

      // Посадка дублёра синхронна: Stop успевает прийти только до её начала
      if (isSlamRequested) log.push('slam')

      isSlamRequested = false

      advanceUntilIdle(machine)
      await landing

      log.push('land')
    },
    slam: () => {
      isSlamRequested = true
      machine.slam()
    },
    explode: async () => {
      log.push('explode')
    },
    cascade: async (symbolKeys: SlotReelsData, removed: readonly CellIndex[]) => {
      machine.setData(symbolKeys)

      const falling = machine.cascade({ removed })

      // Падение дублёра синхронно: Stop успевает прийти только до его начала
      if (isSlamRequested) log.push('cascadeSlam')

      isSlamRequested = false

      advanceUntilIdle(machine)
      await falling

      log.push('cascade')
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
    readAnticipation: () => lastAnticipation,
  }

  // Фазы видят контроллер только как тип и зовут ровно эти методы; остального PIXI-наследия им не нужно
  return stub as unknown as ReelsMachineController & ReelsMachineStub
}

export type HoldWinMachineStub = {
  /** Видимое поле бонуса `[барабан][ряд]`: чем ячейки кончили последний шаг. */
  readGrid: () => HoldWinCell[][]
}

/**
 * Дублёр контроллера рил-машины Hold & Win поверх настоящей машины ячеек: `land` синхронно прокручивает
 * барабаны и сажает их на поле шага. Удержанные ячейки не крутятся. `slam` уходит в модель, применённая
 * промотка отмечается в журнале как `holdWinSlam`.
 */
export const createHoldWinMachineStub = (log: PresentationLog): HoldWinMachineController & HoldWinMachineStub => {
  const machine = new ReelsMachine(HOLD_WIN_REELS)
  let isSlamRequested = false

  const stub = {
    show: async (frame: CoinValue[][] | undefined) => {
      log.push('showHoldWin')
      machine.setData(frame ? toHoldWinReelsData(frame) : null)
      machine.reset()
    },
    hide: async () => {
      log.push('hideHoldWin')
    },
    spin: (held: readonly CellIndex[]) => {
      log.push('holdWinSpin')
      machine.spin({ held: held.map(toHoldWinReel) })
    },
    land: async (frame: CoinValue[][]) => {
      machine.setData(toHoldWinReelsData(frame))

      const landing = machine.land()

      if (isSlamRequested) log.push('holdWinSlam')

      isSlamRequested = false

      advanceUntilIdle(machine)
      await landing

      log.push('holdWinLand')
    },
    slam: () => {
      isSlamRequested = true
      machine.slam()
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

  return stub as unknown as HoldWinMachineController & HoldWinMachineStub
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
