// @vitest-environment jsdom
import { reaction } from 'mobx'
import { MockScenario } from 'src/games/slot/mocks/types'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { ForcedMechanic, PhaseName } from 'src/games/slot/types'
import { afterEach, describe, expect, it } from 'vitest'

import type { HoldWinStub, ReelsStub } from '../../setup/doubles'
import { type Round, startRound } from '../../setup/round'

/** Сид сценария `holdwin`, в котором выигрывает и базовый спин. */
const HOLD_WIN_WITH_BASE_WIN_SEED = 1

let round: Round | undefined

afterEach(async () => {
  await round?.stop()
  round = undefined
})

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

    const reels = round.container.get(SLOT_TOKENS.ReelsMachineController) as unknown as ReelsStub

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
    const reels = round.container.get(SLOT_TOKENS.ReelsMachineController) as unknown as ReelsStub

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

  it('не переносит Stop, нажатый вне вращения, в следующий раунд', async () => {
    round = await startRound({ scenario: MockScenario.bigwin })

    round.emitter.emit('ui:stopRequested')
    await round.playSpin()

    expect(round.log).not.toContain('slam')
  })

  it('ведёт презентацию выигрыша в объявленном порядке', async () => {
    round = await startRound({ scenario: MockScenario.bigwin })

    const landed: string[] = []

    round.emitter.on('spin:landed', () => landed.push('spin:landed'))

    await round.playSpin()

    // Событие в прошедшем времени эмитится после посадки, презентация — следом за ним
    expect(round.log).toEqual(['spin', 'land', 'showAllWins', 'showTint', 'playWinLines', 'hideTint', 'waitTicks'])
    expect(landed).toEqual(['spin:landed'])
  })
})

describe('anticipation', () => {
  it('по force сажает барабаны с паузой и открывает выигрыш вспышкой фона', async () => {
    round = await startRound({ scenario: MockScenario.bigwin })

    const { store, log } = round

    store.toggleForcedMechanic(ForcedMechanic.anticipation)
    await round.playSpin()

    expect(store.presentedAnticipation.length).toBeGreaterThan(0)
    expect(store.isAnticipationWin).toBe(true)
    // Вспышка идёт вместе с показом всех линий, разбор линий — после них
    expect(log).toEqual(expect.arrayContaining(['flash', 'showAllWins']))
    expect(log.indexOf('flash')).toBeLessThan(log.indexOf('playWinLines'))
  })

  it('показывает выигрыш без паузы обычным порядком, без вспышки', async () => {
    round = await startRound({ scenario: MockScenario.bigwin })

    await round.playSpin()

    expect(round.store.presentedAnticipation).toEqual([])
    expect(round.log).not.toContain('flash')
  })

  it('в турбо пропускает паузу и вспышку, даже если сервер прислал anticipation', async () => {
    // Настройка anticipation в турбо недоступна: раунд с паузой присылает сценарий сервера
    round = await startRound({ scenario: MockScenario.anticipation })

    const { store, log } = round

    store.toggleTurboEnabled()
    await round.playSpin()

    expect(store.spinAnticipation.length).toBeGreaterThan(0)
    expect(store.presentedAnticipation).toEqual([])
    expect(log).not.toContain('flash')
  })
})

describe('респин', () => {
  it('удерживает барабаны с вайлдом, докручивает остальные и закрывает раунд после последнего шага', async () => {
    round = await startRound({ scenario: MockScenario.respin })

    const { store, emitter, log } = round
    const reels = round.container.get(SLOT_TOKENS.ReelsMachineController) as unknown as ReelsStub
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
    const reels = round.container.get(SLOT_TOKENS.ReelsMachineController) as unknown as ReelsStub
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
    const reels = round.container.get(SLOT_TOKENS.ReelsMachineController) as unknown as ReelsStub
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
    const reels = round.container.get(SLOT_TOKENS.ReelsMachineController) as unknown as ReelsStub
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
    round = await startRound({ scenario: MockScenario.bigwin })

    const { store, emitter } = round
    const { init, bet } = store

    if (!init) throw new Error('init is missing after boot')

    // Кредита ровно на одну ставку: без зачисления выигрышей второго спина серии не будет
    store.applyInit({ ...init, round: { ...init.round, balance: bet, bet } })
    store.toggleTurboEnabled()
    store.holdSpin()
    emitter.emit('ui:spinRequested')

    await waitForLandings(2)

    expect(store.isTurboSeries).toBe(true)

    store.releaseSpin()
    await round.waitForPhase(PhaseName.idle)

    expect(store.credit).toBe(store.spinResult?.balance)
  })
})
