import { configure } from 'mobx'
import { SOUND_STORAGE_KEY } from 'src/games/slot/constants'
import { SlotStore } from 'src/games/slot/stores/slot'
import { ForcedMechanic, PhaseName, StepDirection } from 'src/games/slot/types'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  BETS,
  createInitResult,
  createPayline,
  createSpinResult,
  createSymbols,
  DEFAULT_BET_INDEX,
  INITIAL_BALANCE,
} from '../../setup/slot-data'

/** Стор поднимается в idle с данными раунда: дальше проверяются правила поверх них. */
const createStore = (init = createInitResult()): SlotStore => {
  const store = new SlotStore()

  store.applyInit(init)
  store.setPhase(PhaseName.idle)

  return store
}

/** Подменяет localStorage мапой в памяти; её же возвращает для проверки записей. */
const stubStorage = (initial: Record<string, string> = {}): Map<string, string> => {
  const values = new Map(Object.entries(initial))

  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  })

  return values
}

describe('SlotStore', () => {
  beforeAll(() => {
    // Как в проде: мутация вне экшена должна быть ошибкой, иначе тест мягче боевого рантайма
    configure({ enforceActions: 'always' })
  })

  describe('приём данных раунда', () => {
    it('берёт баланс сервера и позицию прошлой ставки', () => {
      const store = createStore(createInitResult({ bet: BETS[1], balance: 500 }))

      expect(store.credit).toBe(500)
      expect(store.betIndex).toBe(1)
      expect(store.bet).toBe(BETS[1])
    })

    it('откатывается к ставке по умолчанию, если прошлой нет в списке', () => {
      const store = createStore(createInitResult({ bet: 999 }))

      expect(store.betIndex).toBe(DEFAULT_BET_INDEX)
    })
  })

  describe('деньги раунда', () => {
    it('возвращает кредит ровно при откате ставки', () => {
      const store = createStore()

      store.chargeBet()
      expect(store.credit).toBe(INITIAL_BALANCE - store.bet)

      store.refundBet()
      expect(store.credit).toBe(INITIAL_BALANCE)
    })

    it('закрывает раунд серверным балансом и гасит выигрыш', () => {
      const store = createStore()

      store.chargeBet()
      store.setWin(300)
      store.settleRound(1250)

      expect(store.credit).toBe(1250)
      expect(store.win).toBe(0)
    })
  })

  describe('доступность спина', () => {
    it('разрешает спин в idle при достаточном балансе', () => {
      expect(createStore().canSpin).toBe(true)
    })

    it('запрещает спин вне idle', () => {
      const store = createStore()

      store.setPhase(PhaseName.spinning)

      expect(store.canSpin).toBe(false)
    })

    it('запрещает спин, когда ставка больше кредита', () => {
      const store = createStore(createInitResult({ balance: 1 }))

      expect(store.canSpin).toBe(false)
    })

    it('разрешает остановку только во вращении', () => {
      const store = createStore()

      expect(store.canStop).toBe(false)

      store.setPhase(PhaseName.spinning)
      expect(store.canStop).toBe(true)

      store.setPhase(PhaseName.result)
      expect(store.canStop).toBe(false)
    })

    it('не даёт остановку в турбо-режиме', () => {
      const store = createStore()

      store.toggleTurboEnabled()
      store.setPhase(PhaseName.spinning)

      expect(store.canStop).toBe(false)
    })
  })

  describe('турбо', () => {
    it('переключает режим в idle', () => {
      const store = createStore()

      store.toggleTurboEnabled()

      expect(store.isTurboEnabled).toBe(true)
    })

    it('не переключает режим посреди раунда', () => {
      const store = createStore()

      store.setPhase(PhaseName.spinning)
      store.toggleTurboEnabled()

      expect(store.isTurboEnabled).toBe(false)
    })

    it('зажимает спин только в турбо-режиме', () => {
      const store = createStore()

      store.holdSpin()
      expect(store.isSpinHeld).toBe(false)

      store.toggleTurboEnabled()
      store.holdSpin()
      expect(store.isSpinHeld).toBe(true)
    })

    it('не зажимает спин вне idle и без денег на ставку', () => {
      const busy = createStore()
      const broke = createStore(createInitResult({ balance: 0 }))

      for (const store of [busy, broke]) {
        store.toggleTurboEnabled()
      }

      busy.setPhase(PhaseName.spinning)

      for (const store of [busy, broke]) {
        store.holdSpin()
        expect(store.isSpinHeld).toBe(false)
      }
    })
  })

  describe('настройки', () => {
    it('не открываются посреди раунда', () => {
      const store = createStore()

      for (const phase of [PhaseName.spinning, PhaseName.result]) {
        store.setPhase(phase)
        store.openSettings()

        expect(store.isSettingsOpen).toBe(false)
      }
    })

    it('выбирают заказ механики только в idle', () => {
      const store = createStore()

      store.setPhase(PhaseName.respin)
      store.toggleForcedMechanic(ForcedMechanic.respin)
      expect(store.forcedMechanic).toBe(null)

      store.setPhase(PhaseName.idle)
      store.toggleForcedMechanic(ForcedMechanic.respin)
      expect(store.forcedMechanic).toBe(ForcedMechanic.respin)
    })

    it('держат заказанной одну механику: выбор другой снимает прежнюю, повторный — снимает свою', () => {
      const store = createStore()

      store.setPhase(PhaseName.idle)
      store.toggleForcedMechanic(ForcedMechanic.respin)
      store.toggleForcedMechanic(ForcedMechanic.holdWin)
      expect(store.forcedMechanic).toBe(ForcedMechanic.holdWin)

      store.toggleForcedMechanic(ForcedMechanic.holdWin)
      expect(store.forcedMechanic).toBe(null)
    })

    it('снимают anticipation при включении турбо и не дают выбрать его, пока турбо включён', () => {
      const store = createStore()

      store.setPhase(PhaseName.idle)
      store.toggleForcedMechanic(ForcedMechanic.anticipation)
      store.toggleTurboEnabled()
      expect(store.forcedMechanic).toBe(null)

      store.toggleForcedMechanic(ForcedMechanic.anticipation)
      expect(store.forcedMechanic).toBe(null)
      // Остальные механики турбо показывает, их заказ остаётся доступным
      expect(store.canToggleForcedMechanic(ForcedMechanic.holdWin)).toBe(true)
    })
  })

  describe('шаги по спискам', () => {
    it('не выпускает индекс ставки за края списка', () => {
      const store = createStore(createInitResult({ bet: BETS[0] }))

      expect(store.canStepBet(StepDirection.backward)).toBe(false)
      store.stepBet(StepDirection.backward)
      expect(store.betIndex).toBe(0)

      store.stepBet(StepDirection.forward)
      expect(store.betIndex).toBe(1)
    })

    it('запрещает менять ставку вне idle', () => {
      const store = createStore()

      store.setPhase(PhaseName.spinning)
      store.stepBet(StepDirection.forward)

      expect(store.betIndex).toBe(DEFAULT_BET_INDEX)
    })

    it('переносит индекс ставки при смене режима и пересчитывает линии', () => {
      const store = createStore()

      expect(store.gameMode).toBe('4')
      expect(store.lines).toBe(10)

      store.stepGameMode(StepDirection.backward)

      expect(store.gameMode).toBe('3')
      expect(store.lines).toBe(7)
      expect(store.betIndex).toBe(DEFAULT_BET_INDEX)
      expect(store.bet).toBe(BETS[DEFAULT_BET_INDEX])
    })
  })

  describe('чтение результата спина', () => {
    it('отдаёт пустые значения, пока результата нет', () => {
      const store = createStore()

      expect(store.spinSymbols).toBeUndefined()
      expect(store.spinPaylines).toEqual([])
      expect(store.spinWin).toBe(0)
    })

    it('разбирает трансформации ответа', () => {
      const store = createStore()
      const symbols = createSymbols()
      const paylines = [createPayline()]

      store.applySpin(createSpinResult({ win: 300, paylines, symbols }))

      expect(store.spinSymbols).toEqual(symbols)
      expect(store.spinPaylines).toEqual(paylines)
      expect(store.spinWin).toBe(300)
    })

    it('гасит прошлый результат перед новым запросом', () => {
      const store = createStore()

      store.applySpin(createSpinResult({ win: 300 }))
      store.clearSpin()

      expect(store.spinResult).toBeNull()
      expect(store.spinWin).toBe(0)
    })
  })

  describe('настройка звука', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('поднимается с сохранённым значением', () => {
      stubStorage({ [SOUND_STORAGE_KEY]: 'false' })

      expect(new SlotStore().isSoundOn).toBe(false)
    })

    it('сохраняет переключение для следующего запуска', () => {
      const values = stubStorage()

      new SlotStore().toggleSound()

      expect(values.get(SOUND_STORAGE_KEY)).toBe('false')
      expect(new SlotStore().isSoundOn).toBe(false)
    })

    it('включён, если в хранилище не булево значение', () => {
      stubStorage({ [SOUND_STORAGE_KEY]: 'not-json' })

      expect(new SlotStore().isSoundOn).toBe(true)
    })
  })
})
