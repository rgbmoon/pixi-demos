// @vitest-environment jsdom
import { NoticeSeverity, type Notice } from 'src/core/errors/types'
import { onNotice } from 'src/core/errors/utils'
import { MockScenario } from 'src/games/slot/mocks/types'
import { PhaseName } from 'src/games/slot/types'
import { WS_URL } from 'src/net/constants'
import { createWsHandler } from 'src/net/mocks/create-ws-handler'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { server } from '../../setup/msw-server'
import { createRound, type Round, startRound } from '../../setup/round'

let round: Round | undefined
let notices: Notice[]
let offNotice: () => void

beforeEach(() => {
  notices = []
  offNotice = onNotice((notice) => notices.push(notice))
})

afterEach(async () => {
  offNotice()
  await round?.stop()
  round = undefined
})

describe('отказы раунда', () => {
  it('возвращает ставку и показывает ошибку, когда сервер отверг спин', async () => {
    round = await startRound({ scenario: MockScenario.error })

    const creditBefore = round.store.credit

    await round.playSpin()

    expect(round.store.credit).toBe(creditBefore)
    expect(notices).toEqual([expect.objectContaining({ severity: NoticeSeverity.error })])
    expect(round.store.phase).toBe(PhaseName.idle)
    // Раунд провалился, но игра осталась играбельной
    expect(round.store.canSpin).toBe(true)
  })

  it('не трогает ставку и молчит, если игрок ушёл посреди спина', async () => {
    round = await startRound()

    const creditBefore = round.store.credit
    const { bet } = round.store

    round.requestSpin()
    await round.waitForPhase(PhaseName.spinning)

    round.fsm.dispose()
    await round.started

    // Откатывать ставку остановленному автомату незачем: раунд разберёт сервер
    expect(round.store.credit).toBe(creditBefore - bet)
    expect(round.store.phase).toBe(PhaseName.spinning)
    expect(notices).toEqual([])
  })

  it('объявляет фатальную ошибку, если бутстрап не поднялся', async () => {
    // Единственный хендлер на этот URL: штатные не ставим, иначе они спорят за соединение
    server.use(
      createWsHandler({
        url: WS_URL,
        endpoints: { initGame: (_args, _reply, fail) => fail('init failed') },
      })
    )

    round = createRound({ withHandlers: false })

    await round.fsm.start()

    expect(notices).toEqual([expect.objectContaining({ severity: NoticeSeverity.fatal })])
    expect(round.store.phase).toBe(PhaseName.booting)
  })
})
