import { afterEach, describe, expect, it, vi } from 'vitest'

import { SOUND_STORAGE_KEY } from '#src/constants'
import { SlotStore } from '#src/stores/slot'
import { ForcedMechanic, PhaseName, StepDirection } from '#src/types'

import { BETS, createInitResult, DEFAULT_BET_INDEX, MODE_3_BETS } from './setup/slot-data'

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

/** Всё, что игрок меняет между раундами. */
const readSettings = (store: SlotStore) => ({
  betIndex: store.betIndex,
  gameMode: store.gameMode,
  isTurboEnabled: store.isTurboEnabled,
  forcedMechanic: store.forcedMechanic,
  isSettingsOpen: store.isSettingsOpen,
  isSpinHeld: store.isSpinHeld,
})

/**
 * Зовёт каждый экшен, который пишет кнопка игрока. Порядок подобран так, чтобы в idle сработал каждый:
 * удержание — пока турбо включён, шаг ставки — пока настройки закрыты.
 */
const changeSettings = (store: SlotStore): void => {
  store.holdSpin()
  store.stepBet(StepDirection.forward)
  store.stepGameMode(StepDirection.backward)
  store.toggleForcedMechanic(ForcedMechanic.respin)
  store.toggleTurboEnabled()
  store.openSettings()
}

const NON_IDLE_PHASES = Object.values(PhaseName).filter((phase) => phase !== PhaseName.idle)

describe('SlotStore', () => {
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

  describe('настройки игрока', () => {
    it('меняются в idle', () => {
      const store = createStore()

      store.toggleTurboEnabled()

      const before = readSettings(store)

      changeSettings(store)

      // Каждое поле сдвинулось: без этого проверка неизменности вне idle прошла бы и на сломанных экшенах
      Object.entries(readSettings(store)).forEach(([key, value]) => {
        expect(value, key).not.toEqual(before[key as keyof typeof before])
      })
    })

    it.each(NON_IDLE_PHASES)('не меняются в фазе %s', (phase) => {
      const store = createStore()

      store.toggleTurboEnabled()
      store.setPhase(phase)

      const before = readSettings(store)

      changeSettings(store)

      expect(readSettings(store)).toEqual(before)
    })

    it('зажимают спин только в турбо-режиме и при деньгах на ставку', () => {
      const store = createStore()
      const broke = createStore(createInitResult({ balance: 0 }))

      store.holdSpin()
      expect(store.isSpinHeld).toBe(false)

      store.toggleTurboEnabled()
      store.holdSpin()
      expect(store.isSpinHeld).toBe(true)

      broke.toggleTurboEnabled()
      broke.holdSpin()
      expect(broke.isSpinHeld).toBe(false)
    })

    it('снимают anticipation при включении турбо и не дают выбрать его, пока турбо включён', () => {
      const store = createStore()

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

    it('при смене режима берёт ставку из списка нового режима на той же позиции', () => {
      const store = createStore()

      expect(store.bet).toBe(BETS[DEFAULT_BET_INDEX])

      store.stepGameMode(StepDirection.backward)

      expect(store.gameMode).toBe('3')
      expect(store.bet).toBe(MODE_3_BETS[DEFAULT_BET_INDEX])
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
