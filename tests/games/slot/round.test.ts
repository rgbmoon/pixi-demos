// @vitest-environment jsdom
import { reaction } from 'mobx'
import type { Notice } from 'src/core/errors/types'
import { onNotice } from 'src/core/errors/utils'
import { MockScenario } from 'src/games/slot/mocks/types'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { ForcedMechanic, PhaseName, StepDirection } from 'src/games/slot/types'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { HoldWinStub, ReelsStub } from '../../setup/doubles'
import { type Round, startRound } from '../../setup/round'

/** Сид сценария `holdwin`, в котором выигрывает и базовый спин. */
const HOLD_WIN_WITH_BASE_WIN_SEED = 1

/** Ставка мока по умолчанию: режим Line10, первая позиция списка. */
const MOCK_BET = 0.1

let round: Round | undefined
let notices: Notice[]
let offNotice: () => void

beforeEach(() => {
  notices = []
  offNotice = onNotice((notice) => notices.push(notice))
})

afterEach(async () => {
  await round?.stop()
  round = undefined
  offNotice()

  // Успешный раунд проходит без единого уведомления: ошибка в любой ветке всплыла бы здесь
  expect(notices).toEqual([])
})

const getReels = (current: Round) => current.container.get(SLOT_TOKENS.ReelsMachineController) as unknown as ReelsStub

describe('раунд', () => {
  it('проводит выигрышный раунд от ставки до нового idle', async () => {
    round = await startRound({ scenario: MockScenario.bigwin })

    const { store, log } = round
    const creditBefore = store.credit
    const { bet } = store

    round.requestSpin()
    await round.waitForPhase(PhaseName.spinning)

    // Ставка списывается сразу, не дожидаясь ответа сервера
    expect(store.credit).toBe(creditBefore - bet)

    await round.waitForPhase(PhaseName.idle)

    expect(store.spinWin).toBeGreaterThan(0)
    expect(store.spinPaylines.length).toBeGreaterThan(0)
    // Раунд закрывается серверным балансом, выигрыш в него уже включён
    expect(store.credit).toBe(store.spinResult?.balance)
    expect(store.win).toBe(0)
    expect(store.canSpin).toBe(true)
    expect(log).toContain('land')
  })

  it('сажает барабаны ровно на серверную сетку', async () => {
    round = await startRound({ scenario: MockScenario.bigwin })

    const reels = getReels(round)

    await round.playSpin()

    expect(reels.readGrid()).toEqual(round.store.spinSymbols)
  })

  it('проводит раунд без выигрыша, не показывая линии', async () => {
    round = await startRound({ scenario: MockScenario.nowin })

    await round.playSpin()

    expect(round.store.spinWin).toBe(0)
    expect(round.store.spinPaylines).toEqual([])
    // Презентация выплат не запускается вовсе
    expect(round.log).not.toContain('playWinLines')
    expect(round.log).not.toContain('showAllWins')
  })

  it('по Stop сажает барабаны сразу на серверную сетку и закрывает раунд серверным балансом', async () => {
    round = await startRound({ scenario: MockScenario.bigwin })

    const { store, emitter } = round
    const reels = getReels(round)

    round.requestSpin()
    await round.waitForPhase(PhaseName.spinning)

    // Stop приходит раньше ответа сервера: посадка ждёт данные и начинается сразу с промотки
    expect(store.canStop).toBe(true)
    emitter.emit('ui:stopRequested')

    await round.waitForPhase(PhaseName.idle)

    expect(round.log).toEqual(expect.arrayContaining(['slam', 'land']))
    expect(reels.readGrid()).toEqual(store.spinSymbols)
    expect(store.credit).toBe(store.spinResult?.balance)
    // Сигнал Stop живёт только фазу вращения
    expect(emitter.listenerCounts()['ui:stopRequested'] ?? 0).toBe(0)
  })

  it('объявляет посадку после остановки барабанов и до показа выигрыша', async () => {
    round = await startRound({ scenario: MockScenario.bigwin })

    const { log, emitter } = round
    const at = (entry: string) => log.indexOf(entry)

    emitter.on('spin:landed', () => log.push('spin:landed'))

    await round.playSpin()

    expect(log).toEqual(
      expect.arrayContaining(['land', 'spin:landed', 'showAllWins', 'showTint', 'playWinLines', 'hideTint'])
    )
    // Событие в прошедшем времени эмитится после посадки: подписчик видит остановленные барабаны
    expect(at('land')).toBeLessThan(at('spin:landed'))
    expect(at('spin:landed')).toBeLessThan(at('showAllWins'))
    // Разбор по линиям идёт под затемнением
    expect(at('showTint')).toBeLessThan(at('playWinLines'))
    expect(at('playWinLines')).toBeLessThan(at('hideTint'))
  })

  it('списывает и отправляет на сервер ставку, выбранную игроком', async () => {
    round = await startRound({ scenario: MockScenario.nowin })

    const { store } = round

    store.stepBet(StepDirection.forward)

    const { bet, credit: creditBefore } = store

    await round.playSpin()

    expect(bet).not.toBe(MOCK_BET)
    expect(store.spinResult?.bet).toBe(bet)
    // Баланс сервера без выигрыша: сервер списал ровно ту ставку, что списал клиент
    expect(store.credit).toBeCloseTo(creditBefore - bet, 2)
  })
})

describe('anticipation', () => {
  it('по force сажает барабаны с паузой и открывает выигрыш вспышкой фона', async () => {
    round = await startRound({ scenario: MockScenario.bigwin })

    const { store, log } = round

    store.toggleForcedMechanic(ForcedMechanic.anticipation)
    await round.playSpin()

    expect(store.spinAnticipation.length).toBeGreaterThan(0)
    // Барабаны получили ровно те паузы, что прислал сервер
    expect(getReels(round).readAnticipation()).toEqual(store.spinAnticipation)
    // Вспышка идёт вместе с показом всех линий, разбор линий — после них
    expect(log).toEqual(expect.arrayContaining(['flash', 'showAllWins', 'playWinLines']))
    expect(log.indexOf('flash')).toBeLessThan(log.indexOf('playWinLines'))
  })

  it('показывает выигрыш без паузы обычным порядком, без вспышки', async () => {
    round = await startRound({ scenario: MockScenario.bigwin })

    await round.playSpin()

    // Выигрыш есть: вспышку отличает от обычного показа только пауза
    expect(round.store.spinWin).toBeGreaterThan(0)
    expect(getReels(round).readAnticipation()).toEqual([])
    expect(round.log).not.toContain('flash')
  })

  it('в турбо пропускает паузу и вспышку, даже если сервер прислал anticipation', async () => {
    // Настройка anticipation в турбо недоступна: раунд с паузой присылает сценарий сервера
    round = await startRound({ scenario: MockScenario.anticipation })

    const { store, log } = round

    store.toggleTurboEnabled()
    await round.playSpin()

    // Сид даёт паузу и выигрыш: без них отсутствие вспышки ничего не доказывает
    expect(store.spinAnticipation.length).toBeGreaterThan(0)
    expect(store.spinWin).toBeGreaterThan(0)
    expect(getReels(round).readAnticipation()).toEqual([])
    expect(log).not.toContain('flash')
  })
})

describe('респин', () => {
  it('удерживает барабаны с вайлдом, докручивает остальные и закрывает раунд после последнего шага', async () => {
    round = await startRound({ scenario: MockScenario.respin })

    const { store, emitter, log } = round
    const reels = getReels(round)
    const creditBefore = store.credit
    const { bet } = store
    const credits: number[] = []

    emitter.on('respin:started', () => credits.push(store.credit))

    await round.playSpin()

    const steps = store.spinRespins

    expect(steps.length).toBeGreaterThan(0)
    expect(log.filter((entry) => entry === 'respin')).toHaveLength(steps.length)
    // Баланс ответа включает все шаги: до последнего кредит видит только списанную ставку
    expect(credits).toEqual(steps.map(() => creditBefore - bet))
    expect(reels.readGrid()).toEqual(steps.at(-1)?.frame)
    expect(store.credit).toBe(store.spinResult?.balance)
    expect(store.win).toBe(0)
    expect(store.heldReels).toEqual([])
  })

  it('показывает выигрыш каждого шага и копит сумму шагов в строке WIN', async () => {
    round = await startRound({ scenario: MockScenario.respin, seed: 3 })

    const { store, emitter, log } = round
    const wins: number[] = []

    emitter.on('respin:landed', () => wins.push(store.win))

    await round.playSpin()

    const stepPaylines = [store.spinPaylines, ...store.spinRespins.map((step) => step.paylines)]
    const stepWins = [store.spinWin, ...store.spinRespins.map((step) => step.win)]
    let sum = 0

    // Сид даёт цепочку из нескольких шагов с выигрышами: без неё проверка накопления пуста
    expect(stepWins.filter((win) => win > 0).length).toBeGreaterThan(1)
    // На посадке каждого респина в строке WIN сумма всех предыдущих шагов
    expect(wins).toEqual(stepWins.slice(0, -1).map((win) => (sum += win)))
    expect(log.filter((entry) => entry === 'showAllWins')).toHaveLength(
      stepPaylines.filter((paylines) => paylines.length > 0).length
    )
  })

  it('по Stop на респине проматывает его посадку и доводит раунд до конца', async () => {
    round = await startRound({ scenario: MockScenario.respin })

    const { store, emitter, log } = round
    const reels = getReels(round)
    const canStop: boolean[] = []

    emitter.on('respin:started', () => {
      canStop.push(store.canStop)
      emitter.emit('ui:stopRequested')
    })

    await round.playSpin()

    expect(canStop.every(Boolean)).toBe(true)
    expect(log.indexOf('slam')).toBeGreaterThan(log.indexOf('respin'))
    expect(reels.readGrid()).toEqual(store.spinRespins.at(-1)?.frame)
    // Сигнал Stop живёт только фазу респина
    expect(emitter.listenerCounts()['ui:stopRequested'] ?? 0).toBe(0)
  })

  it('по force присылает респин и в турбо проводит шаги без выдержек и полного разбора линий', async () => {
    round = await startRound({ scenario: MockScenario.bigwin })

    const { store, log } = round

    store.toggleForcedMechanic(ForcedMechanic.respin)
    store.toggleTurboEnabled()
    await round.playSpin()

    expect(store.spinRespins.length).toBeGreaterThan(0)
    expect(log).toContain('respin')
    expect(log).not.toContain('waitTicks')
    expect(log).not.toContain('playWinLines')
    expect(store.credit).toBe(store.spinResult?.balance)
  })
})

describe('Hold & Win', () => {
  it('меняет доску на поле бонуса, проводит все шаги сервера и закрывает раунд серверным балансом', async () => {
    round = await startRound({ scenario: MockScenario.holdwin })

    const { store, emitter, log } = round
    const holdWin = round.container.get(SLOT_TOKENS.HoldWinController) as unknown as HoldWinStub
    const creditBefore = store.credit
    const { bet } = store
    const credits: number[] = []

    emitter.on('holdWin:landed', () => credits.push(store.credit))

    await round.playSpin()

    const bonus = store.spinHoldWin

    if (!bonus) throw new Error('holdwin scenario returned no bonus')

    // Каждый шаг сервера показан одной посадкой, поле встаёт на кадр последнего шага
    expect(log.filter((entry) => entry === 'holdWinLand')).toHaveLength(bonus.steps.length)
    expect(holdWin.readGrid()).toEqual(bonus.steps.at(-1)?.frame)
    // Доска бонуса появляется до первого шага, сбор идёт после последнего, базовая доска возвращается после сбора
    expect(log.indexOf('showHoldWin')).toBeLessThan(log.indexOf('holdWinSpin'))
    expect(log.indexOf('holdWinCollect')).toBeGreaterThan(log.lastIndexOf('holdWinLand'))
    expect(log.indexOf('showReels')).toBeGreaterThan(log.indexOf('holdWinCollect'))
    // Баланс ответа включает бонус: до его конца кредит видит только списанную ставку
    expect(credits).toEqual(bonus.steps.map(() => creditBefore - bet))
    expect(store.credit).toBe(store.spinResult?.balance)
    expect(store.win).toBe(0)
  })

  it('держит в строке WIN сумму базового спина и бонуса до зачисления', async () => {
    round = await startRound({ scenario: MockScenario.holdwin, seed: HOLD_WIN_WITH_BASE_WIN_SEED })

    const { store } = round
    const wins: number[] = []

    reaction(
      () => store.win,
      (win) => wins.push(win)
    )

    await round.playSpin()

    // Сид даёт выигрыш и на базовом спине: без него проверка накопления пуста
    expect(store.spinWin).toBeGreaterThan(0)
    // Последняя сумма перед зачислением (оно гасит строку в ноль) — базовый выигрыш плюс бонус
    expect(wins.at(-2)).toBeCloseTo(store.spinWin + (store.spinHoldWin?.win ?? 0), 2)
  })

  it('по Stop на шаге бонуса проматывает его посадку', async () => {
    round = await startRound({ scenario: MockScenario.holdwin })

    const { store, emitter, log } = round
    const canStop: boolean[] = []

    emitter.on('holdWin:spinStarted', () => {
      canStop.push(store.canStop)
      emitter.emit('ui:stopRequested')
    })

    await round.playSpin()

    const steps = store.spinHoldWin?.steps ?? []

    expect(canStop).toEqual(steps.map(() => true))
    expect(log.filter((entry) => entry === 'holdWinSlam')).toHaveLength(steps.length)
    // Сигнал Stop живёт только фазу шага
    expect(emitter.listenerCounts()['ui:stopRequested'] ?? 0).toBe(0)
  })

  it('по force присылает бонус и в турбо проводит его без выдержек', async () => {
    round = await startRound({ scenario: MockScenario.nowin })

    const { store, log } = round

    store.toggleForcedMechanic(ForcedMechanic.holdWin)
    store.toggleTurboEnabled()
    await round.playSpin()

    expect(store.spinHoldWin).toBeDefined()
    expect(log).toContain('holdWinCollect')
    expect(log).not.toContain('waitTicks')
    expect(store.credit).toBe(store.spinResult?.balance)
  })
})

describe('каскад', () => {
  it('проводит цепочку каскадов до кадра без выигрыша и закрывает раунд серверным балансом', async () => {
    round = await startRound({ scenario: MockScenario.cascade })

    const { store, emitter, log } = round
    const reels = getReels(round)
    const creditBefore = store.credit
    const { bet } = store
    const credits: number[] = []

    emitter.on('cascade:landed', () => credits.push(store.credit))

    await round.playSpin()

    const steps = store.spinCascades

    // Сид даёт цепочку из нескольких шагов: без неё проверка порядка пуста
    expect(steps.length).toBeGreaterThan(1)
    expect(steps.at(-1)?.paylines).toEqual([])
    // Каждый шаг — взрыв и падение; выигрыш перед взрывом показан разом, без разбора по линиям
    expect(log.filter((entry) => entry === 'explode')).toHaveLength(steps.length)
    expect(log.filter((entry) => entry === 'cascade')).toHaveLength(steps.length)
    expect(log.indexOf('showAllWins')).toBeLessThan(log.indexOf('explode'))
    expect(log).not.toContain('playWinLines')
    expect(reels.readGrid()).toEqual(steps.at(-1)?.frame)
    // Баланс ответа включает все шаги: до последнего кредит видит только списанную ставку
    expect(credits).toEqual(steps.map(() => creditBefore - bet))
    expect(store.credit).toBe(store.spinResult?.balance)
    expect(store.win).toBe(0)
  })

  it('копит в строке WIN базовый выигрыш и выигрыши шагов, показывая множитель каждого шага', async () => {
    round = await startRound({ scenario: MockScenario.cascade })

    const { store, emitter } = round
    const wins: number[] = []
    const multipliers: (number | null)[] = []

    reaction(
      () => store.win,
      (win) => wins.push(win)
    )
    emitter.on('cascade:landed', () => multipliers.push(store.cascadeMultiplier))

    await round.playSpin()

    const steps = store.spinCascades
    const total = steps.reduce((sum, step) => sum + step.win, store.spinWin)

    // Последняя сумма перед зачислением (оно гасит строку в ноль) — базовый выигрыш плюс шаги
    expect(wins.at(-2)).toBeCloseTo(total, 2)
    expect(multipliers).toEqual(steps.map((step) => step.multiplier))
    // По закрытии раунда множителя на поле нет
    expect(store.cascadeMultiplier).toBeNull()
  })

  it('по Stop во время каскада проматывает падение', async () => {
    round = await startRound({ scenario: MockScenario.cascade })

    const { store, emitter, log } = round
    const reels = getReels(round)
    const canStop: boolean[] = []

    emitter.on('cascade:started', () => {
      canStop.push(store.canStop)
      emitter.emit('ui:stopRequested')
    })

    await round.playSpin()

    const steps = store.spinCascades

    expect(canStop).toEqual(steps.map(() => true))
    expect(log.filter((entry) => entry === 'cascadeSlam')).toHaveLength(steps.length)
    expect(reels.readGrid()).toEqual(steps.at(-1)?.frame)
    // Сигнал Stop живёт только фазу каскада
    expect(emitter.listenerCounts()['ui:stopRequested'] ?? 0).toBe(0)
  })

  it('по force присылает каскад и в турбо проводит цепочку без выдержек', async () => {
    round = await startRound({ scenario: MockScenario.bigwin })

    const { store, log } = round

    store.toggleForcedMechanic(ForcedMechanic.cascade)
    store.toggleTurboEnabled()
    await round.playSpin()

    expect(store.spinCascades.length).toBeGreaterThan(0)
    expect(log).toContain('cascade')
    expect(log).not.toContain('waitTicks')
    expect(store.credit).toBe(store.spinResult?.balance)
  })
})

describe('турбо-режим', () => {
  /** Ждёт `count` посадок подряд: столько спинов серия прошла с момента вызова. */
  const waitForLandings = async (count: number): Promise<void> => {
    for (let landed = 0; landed < count; landed += 1) {
      await round?.emitter.waitFor('spin:landed', { timeoutMs: 5000 })
    }
  }

  it('по тапу проводит один турбо-спин с коротким показом выигрыша', async () => {
    round = await startRound({ scenario: MockScenario.bigwin })

    const { store, log } = round

    store.toggleTurboEnabled()
    await round.playSpin()

    expect(log).toContain('showAllWins')
    expect(log).not.toContain('playWinLines')
    expect(store.isTurboSeries).toBe(false)
    expect(store.credit).toBe(store.spinResult?.balance)
  })

  it('держит выигрыши серии в строке WIN и зачисляет их по отпусканию', async () => {
    round = await startRound({ scenario: MockScenario.bigwin })

    const { store, emitter, log } = round
    const creditBefore = store.credit

    store.toggleTurboEnabled()
    store.holdSpin()
    emitter.emit('ui:spinRequested')

    await waitForLandings(3)

    // Серия идёт, выигрыши копятся отдельно: банк видит только списанные ставки
    expect(store.isTurboSeries).toBe(true)
    expect(store.win).toBeGreaterThan(0)
    expect(store.credit).toBeLessThan(creditBefore)

    store.releaseSpin()
    await round.waitForPhase(PhaseName.idle)

    expect(store.isTurboSeries).toBe(false)
    expect(store.win).toBe(0)
    expect(store.credit).toBe(store.spinResult?.balance)
    expect(log).not.toContain('playWinLines')
  })

  it('зачисляет выигрыши и продолжает серию, когда банк кончился', async () => {
    // Кредита ровно на одну ставку: без зачисления выигрышей второго спина серии не будет
    round = await startRound({ scenario: MockScenario.bigwin, balance: MOCK_BET })

    const { store, emitter } = round

    store.toggleTurboEnabled()
    store.holdSpin()
    emitter.emit('ui:spinRequested')

    await waitForLandings(2)

    expect(store.isTurboSeries).toBe(true)

    store.releaseSpin()
    await round.waitForPhase(PhaseName.idle)

    expect(store.credit).toBe(store.spinResult?.balance)
  })

  it('закрывает серию, когда кредит не покрывает ставку и после зачисления', async () => {
    // Кредита на две ставки, выигрышей нет: третьего спина серии не будет
    round = await startRound({ scenario: MockScenario.nowin, balance: 2 * MOCK_BET })

    const { store, emitter } = round
    let landings = 0

    emitter.on('spin:landed', () => {
      landings += 1
    })

    store.toggleTurboEnabled()
    store.holdSpin()
    emitter.emit('ui:spinRequested')

    await round.waitForPhase(PhaseName.spinning)
    await round.waitForPhase(PhaseName.idle)

    expect(landings).toBe(2)
    // Кнопка ещё зажата, но серия закрыта, а спин недоступен
    expect(store.isSpinHeld).toBe(true)
    expect(store.isTurboSeries).toBe(false)
    expect(store.canSpin).toBe(false)
    expect(store.credit).toBe(store.spinResult?.balance)
  })
})

describe('доступность спина и Stop', () => {
  /** Спит ли фаза idle до следующего запроса спина: запрос, прошедший фильтр, снимает её подписку синхронно. */
  const isWaitingForSpin = (current: Round): boolean =>
    (current.emitter.listenerCounts()['ui:spinRequested'] ?? 0) > 0

  it('не начинает раунд без денег на ставку и начинает, когда ставка снова по карману', async () => {
    round = await startRound({ scenario: MockScenario.nowin, balance: 1.5 * MOCK_BET })

    const { store } = round
    const creditBefore = store.credit

    store.stepBet(StepDirection.forward)
    round.requestSpin()

    expect(isWaitingForSpin(round)).toBe(true)
    expect(store.credit).toBe(creditBefore)

    store.stepBet(StepDirection.backward)
    await round.playSpin()

    // Сервер списал одну ставку: отвергнутый запрос до него не дошёл
    expect(store.credit).toBeCloseTo(creditBefore - MOCK_BET, 2)
  })

  it('не начинает раунд при открытых настройках', async () => {
    round = await startRound({ scenario: MockScenario.nowin })

    const { store } = round
    const creditBefore = store.credit

    store.openSettings()
    round.requestSpin()

    expect(isWaitingForSpin(round)).toBe(true)
    expect(store.credit).toBe(creditBefore)

    store.closeSettings()
    await round.playSpin()

    expect(store.credit).toBeCloseTo(creditBefore - MOCK_BET, 2)
  })

  it('в турбо-режиме не проматывает посадку по Stop', async () => {
    round = await startRound({ scenario: MockScenario.bigwin })

    const { store, emitter } = round

    store.toggleTurboEnabled()
    emitter.on('spin:started', () => emitter.emit('ui:stopRequested'))

    await round.playSpin()

    expect(round.log).not.toContain('slam')
  })
})

describe('раунд за раундом', () => {
  const STEP_CASES: [MockScenario, string, (store: SlotStore) => number][] = [
    [MockScenario.respin, 'respin', (store) => store.spinRespins.length],
    [MockScenario.cascade, 'cascade', (store) => store.spinCascades.length],
    [MockScenario.holdwin, 'holdWinLand', (store) => store.spinHoldWin?.steps.length ?? 0],
  ]

  it.each(STEP_CASES)('после раунда %s следующий такой же проходит все свои шаги', async (scenario, entry, countSteps) => {
    round = await startRound({ scenario })

    await round.playSpin()

    const firstRoundLength = round.log.length

    await round.playSpin()

    const steps = countSteps(round.store)

    // Шаги прошлого раунда, не сброшенные перед новым, сдвинули бы начало цепочки или скрыли её целиком
    expect(steps).toBeGreaterThan(0)
    expect(round.log.slice(firstRoundLength).filter((item) => item === entry)).toHaveLength(steps)
    expect(round.store.credit).toBe(round.store.spinResult?.balance)
  })

  it('не копит подписчиков эмиттера от раунда к раунду', async () => {
    round = await startRound({ scenario: MockScenario.bigwin })

    await round.playSpin()

    const afterFirstRound = round.emitter.listenerCounts()

    // Каждая механика проходит свои фазы со своими подписками на Stop
    for (const scenario of [MockScenario.respin, MockScenario.cascade, MockScenario.holdwin]) {
      round.mock.scenario = scenario
      await round.playSpin()
    }

    expect(round.emitter.listenerCounts()).toEqual(afterFirstRound)
  })
})
