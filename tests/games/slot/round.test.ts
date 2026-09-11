// @vitest-environment jsdom
import { MockScenario } from 'src/games/slot/mocks/types'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { PhaseName } from 'src/games/slot/types'
import { afterEach, describe, expect, it } from 'vitest'

import type { ReelsStub } from '../../setup/doubles'
import { type Round, startRound } from '../../setup/round'

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

    store.toggleAnticipationForced()
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
    round = await startRound({ scenario: MockScenario.bigwin })

    const { store, log } = round

    store.toggleAnticipationForced()
    store.toggleTurboEnabled()
    await round.playSpin()

    expect(store.spinAnticipation.length).toBeGreaterThan(0)
    expect(store.presentedAnticipation).toEqual([])
    expect(log).not.toContain('flash')
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
