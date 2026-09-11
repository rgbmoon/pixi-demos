import type { GameTicker } from 'src/engine/game-ticker'
import type { ReelsMachineController } from 'src/games/slot/controllers/reels/reels-machine'
import type { SlotReelsData } from 'src/games/slot/reels'

import { advanceUntilIdle, createMachine, readVisibleGrid } from './reels'

/** Журнал вызовов презентации в порядке их появления. */
export type PresentationLog = string[]

export type ReelsStub = {
  /** Видимая сетка модели: чем барабаны кончили раунд. */
  readGrid: () => (string | undefined)[][]
}

/**
 * Дублёр контроллера барабанов поверх настоящей модели: `land` действительно прокручивает
 * ленты и сажает их на данные раунда, только синхронно и без рендера. Сработавший `stopSignal`
 * проматывает посадку настоящим `slam` и отмечается в журнале.
 * Методы презентации резолвятся сразу и отмечаются в журнале.
 */
export const createReelsStub = (log: PresentationLog): ReelsMachineController & ReelsStub => {
  const machine = createMachine()

  const stub = {
    spin: () => {
      log.push('spin')
      machine.spin()
    },
    land: async (symbolKeys: SlotReelsData | undefined, _signal?: AbortSignal, stopSignal?: AbortSignal) => {
      machine.setData((symbolKeys ?? null) as never)

      const landing = machine.land()

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
    readGrid: () => readVisibleGrid(machine),
  }

  // Фазы видят контроллер только как тип и зовут ровно эти методы; остального PIXI-наследия им не нужно
  return stub as unknown as ReelsMachineController & ReelsStub
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
