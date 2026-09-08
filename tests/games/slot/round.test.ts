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
