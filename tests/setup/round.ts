import { Container } from 'inversify'
import { when } from 'mobx'
import { bindApp } from 'src/app/bindings'
import { bindFsm } from 'src/core/bindings'
import type { GameEmitter } from 'src/core/events/game-emitter'
import type { Fsm } from 'src/core/fsm/fsm'
import { createRandom } from 'src/core/random'
import { CORE_TOKENS } from 'src/core/tokens'
import { ENGINE_TOKENS } from 'src/engine/tokens'
import { bindFlow } from 'src/games/slot/bindings'
import type { GameEvents } from 'src/games/slot/events'
import { createHandlers } from 'src/games/slot/mocks/handlers'
import { type MockOptions, MockScenario } from 'src/games/slot/mocks/types'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { PhaseName } from 'src/games/slot/types'
import { WS_URL } from 'src/net/constants'
import { NET_TOKENS } from 'src/net/tokens'
import type { WsTransportOptions } from 'src/net/types'
import { WsTransport } from 'src/net/ws-transport'

import {
  createBackgroundStub,
  createHoldWinStub,
  createReelsStub,
  createTickerStub,
  type PresentationLog,
} from './doubles'
import { server, wsLink } from './msw-server'

export type RoundOptions = {
  /** Форсированный исход мока: по нему сценарий получает предсказуемый раунд. */
  scenario?: MockScenario
  /** Сид генератора мока: один и тот же сид даёт один и тот же раунд. */
  seed?: number
  /** Стартовый баланс игрока на мок-сервере. */
  balance?: number
  /** Ставить ли штатные хендлеры мока. Свой хендлер на тот же URL конфликтует с ними за соединение. */
  withHandlers?: boolean
  /** Опции транспорта вместо боевых: короткий таймаут запроса, быстрое переподключение. */
  transport?: Omit<WsTransportOptions, 'url'>
}

export type Round = {
  container: Container
  fsm: Fsm
  store: SlotStore
  emitter: GameEmitter<GameEvents>
  /** Опции, которые хендлеры мока читают на каждом запросе: смена `scenario` меняет исход следующего спина. */
  mock: MockOptions
  /** Порядок вызовов презентации: по нему проверяется, что момент события совпал с именем. */
  log: PresentationLog
  /** Ждёт, когда автомат объявит указанную фазу. */
  waitForPhase: (phase: PhaseName) => Promise<void>
  /** Полный проход раунда: запрос игрока, вращение и возврат в покой. */
  playSpin: () => Promise<void>
  requestSpin: () => void
  stop: () => Promise<void>
  /** Промис петли автомата: резолвится, когда автомат вышел — по остановке или по фатальной ошибке. */
  started?: Promise<void>
}

/**
 * Собирает раунд без единого PIXI-объекта: настоящие автомат, фазы, стор и протокол
 * поверх мок-сервера. Подменены только барабаны и тикер — фазы видят их лишь как типы.
 * Автомат не запускается: это делает `startRound` либо сам тест.
 */
export const createRound = ({
  scenario = MockScenario.random,
  seed = 1,
  balance,
  withHandlers = true,
  transport,
}: RoundOptions = {}): Round => {
  const mock: MockOptions = { random: createRandom(seed), scenario, balance }

  if (withHandlers) server.use(...createHandlers(mock, wsLink))

  const container = new Container({ defaultScope: 'Singleton' })

  // Транспорт приходит из прод-композиции: сценарий говорит с моком тем же кодом, что и игра.
  // Свои опции заменяют только таймауты транспорта, класс тот же
  if (transport) {
    container
      .bind(NET_TOKENS.WsTransport)
      .toConstantValue(new WsTransport({ url: WS_URL, ...transport }))
      .onDeactivation((instance) => instance.disconnect())
  } else {
    bindApp(container)
  }

  bindFsm(container)
  bindFlow(container)

  const log: PresentationLog = []

  container.bind(SLOT_TOKENS.ReelsMachineController).toConstantValue(createReelsStub(log))
  container.bind(SLOT_TOKENS.HoldWinController).toConstantValue(createHoldWinStub(log))
  container.bind(SLOT_TOKENS.BackgroundController).toConstantValue(createBackgroundStub(log))
  container.bind(ENGINE_TOKENS.GameTicker).toConstantValue(createTickerStub(log))

  const fsm = container.get(CORE_TOKENS.Fsm)
  const store = container.get(SLOT_TOKENS.SlotStore)
  const emitter = container.get(SLOT_TOKENS.GameEmitter)

  const waitForPhase = async (phase: PhaseName): Promise<void> => {
    await when(() => store.phase === phase)
  }

  /** Полный проход раунда: запрос игрока, вращение и возврат в покой. */
  const playSpin = async (): Promise<void> => {
    emitter.emit('ui:spinRequested')

    await waitForPhase(PhaseName.spinning)
    await waitForPhase(PhaseName.idle)
  }

  return {
    container,
    fsm,
    store,
    emitter,
    mock,
    log,
    waitForPhase,
    playSpin,
    requestSpin: () => emitter.emit('ui:spinRequested'),
    stop: async () => {
      fsm.dispose()
      await container.unbindAll()
    },
  }
}

/** Собирает раунд и доводит его до покоя: игра готова принимать спин. */
export const startRound = async (options?: RoundOptions): Promise<Round> => {
  const round = createRound(options)
  const booted = round.emitter.waitFor('game:booted', { timeoutMs: 5000 })
  const started = round.fsm.start()

  await booted
  await round.waitForPhase(PhaseName.idle)

  return { ...round, started }
}
