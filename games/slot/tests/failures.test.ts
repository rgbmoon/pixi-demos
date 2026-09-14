// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { SpinResult } from '#src/api/slot'
import { createHandlers } from '#src/mocks/handlers'
import { MockScenario } from '#src/mocks/types'
import { SLOT_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import { NoticeSeverity, type Notice } from '@pixi-demos/core/errors/types'
import { onNotice } from '@pixi-demos/core/errors/utils'
import { createRandom } from '@pixi-demos/core/random'
import { createWsHandler } from '@pixi-demos/net/mocks/create-ws-handler'

import type { ReelsMachineStub } from './setup/doubles'
import { server, wsLink } from './setup/msw-server'
import { createRound, type Round, startRound } from './setup/round'
import { createInitResult } from './setup/slot-data'

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
    const reels = round.container.get(SLOT_TOKENS.ReelsMachineController) as unknown as ReelsMachineStub

    await round.playSpin()

    expect(round.store.credit).toBe(creditBefore)
    expect(notices).toEqual([expect.objectContaining({ severity: NoticeSeverity.error })])
    expect(round.store.phase).toBe(PhaseName.idle)
    // Барабаны не остаются крутиться: садятся обратно на доску, стоявшую до спина
    expect(reels.readGrid()).toEqual(round.store.initialSymbols)
    // Раунд провалился, но игра осталась играбельной
    expect(round.store.canSpin).toBe(true)
  })

  it('закрывает турбо-серию и возвращает ставку, когда сервер отверг спин', async () => {
    round = await startRound({ scenario: MockScenario.error })

    const { store } = round
    const creditBefore = store.credit

    store.toggleTurboEnabled()
    store.holdSpin()
    round.emitter.emit('ui:spinRequested')

    await round.waitForPhase(PhaseName.spinning)
    await round.waitForPhase(PhaseName.idle)

    // Кнопка ещё зажата, но серия закрыта: новый заход требует нового удержания
    expect(store.isTurboSeries).toBe(false)
    expect(store.credit).toBe(creditBefore)
    expect(notices).toEqual([expect.objectContaining({ severity: NoticeSeverity.error })])
  })

  it('закрывает турбо-серию серверным балансом прошлого спина, когда сервер отверг спин посреди серии', async () => {
    round = await startRound({ scenario: MockScenario.bigwin })

    const { store, emitter, mock } = round
    const landed: SpinResult[] = []

    emitter.on('spin:landed', (result) => {
      landed.push(result)

      // Второй спин серии встал: следующий сервер отвергнет
      if (landed.length === 2) mock.scenario = MockScenario.error
    })

    store.toggleTurboEnabled()
    store.holdSpin()
    emitter.emit('ui:spinRequested')

    await round.waitForPhase(PhaseName.spinning)
    await round.waitForPhase(PhaseName.idle)

    // Выигрыши серии уже в балансе прошлого ответа: он закрывает и серию, и отказ
    expect(landed).toHaveLength(2)
    expect(store.credit).toBe(landed[1].balance)
    expect(store.win).toBe(0)
    expect(store.isTurboSeries).toBe(false)
    expect(notices).toEqual([expect.objectContaining({ severity: NoticeSeverity.error })])
  })

  it('возвращает ставку по таймауту, когда сервер не ответил на спин', async () => {
    // Единственный хендлер на этот URL: инициализация отвечает сразу, спин остаётся без ответа
    server.use(
      createWsHandler({
        link: wsLink,
        delays: { initGame: { min: 0, max: 0 } },
        endpoints: { initGame: (_args, reply) => reply(createInitResult()), spin: () => {} },
      })
    )

    round = await startRound({ withHandlers: false, transport: { timeoutMs: 200 } })

    const creditBefore = round.store.credit

    await round.playSpin()

    expect(round.store.credit).toBe(creditBefore)
    expect(notices).toEqual([expect.objectContaining({ severity: NoticeSeverity.error })])
    expect(round.store.canSpin).toBe(true)
  })

  it('доигрывает раунд, когда связь оборвалась посреди спина: запрос уходит повторно с тем же id', async () => {
    const spinIds: string[] = []

    // Перехватчик стоит первым: первый кадр спина до мок-сервера не доходит, и мок не списывает ставку дважды
    const interceptor = wsLink.addEventListener('connection', ({ client }) => {
      client.addEventListener('message', (event) => {
        const frame = JSON.parse(String(event.data)) as { target?: string; invocationId?: string }

        if (frame.target !== 'spin') return

        spinIds.push(frame.invocationId ?? '')

        if (spinIds.length === 1) {
          event.stopPropagation()
          client.close()
        }
      })
    })

    server.use(interceptor, ...createHandlers({ random: createRandom(1), scenario: MockScenario.nowin }, wsLink))

    round = await startRound({
      withHandlers: false,
      transport: { reconnect: { minDelayMs: 10, maxDelayMs: 10 } },
    })

    const creditBefore = round.store.credit
    const { bet } = round.store

    await round.playSpin()

    expect(spinIds).toHaveLength(2)
    expect(spinIds[1]).toBe(spinIds[0])
    // Сервер исполнил спин один раз: баланс без выигрыша меньше стартового ровно на ставку
    expect(round.store.credit).toBeCloseTo(creditBefore - bet, 2)
    expect(notices).toEqual([])
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
        link: wsLink,
        endpoints: { initGame: (_args, _reply, fail) => fail('init failed') },
      })
    )

    round = createRound({ withHandlers: false })

    await round.fsm.start()

    expect(notices).toEqual([expect.objectContaining({ severity: NoticeSeverity.fatal })])
    expect(round.store.phase).toBe(PhaseName.booting)
  })
})
