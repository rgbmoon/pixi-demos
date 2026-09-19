import { Container } from 'inversify'
import { when } from 'mobx'

import { bindFlow } from '#src/bindings'
import type { ClawController } from '#src/controllers/box/claw'
import type { GameEvents } from '#src/events'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { type GroundPoint, PhaseName } from '#src/types'
import { bindFsm } from '@pixi-demos/core/bindings'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { Fsm } from '@pixi-demos/core/fsm/fsm'
import { CORE_TOKENS } from '@pixi-demos/core/tokens'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/** Порядок движений клешни в том виде, в котором их запросили фазы. */
export type ClawLog = string[]

export type Cycle = {
  container: Container
  fsm: Fsm
  store: ToyboxStore
  emitter: GameEmitter<GameEvents>
  log: ClawLog
  /** Ждёт, когда автомат объявит указанную фазу. */
  waitForPhase: (phase: PhaseName) => Promise<void>
  requestDrop: () => void
  stop: () => Promise<void>
  /** Промис петли автомата: резолвится, когда автомат вышел. */
  started?: Promise<void>
}

/**
 * Дублёр клешни: движения завершаются сразу, но остаются видимыми в журнале.
 * Фазы видят контроллер только как тип и зовут ровно эти методы.
 */
const createClawStub = (log: ClawLog): ClawController => {
  const stub = {
    descend: async () => {
      log.push('descend')
    },
    ascend: async () => {
      log.push('ascend')
    },
    moveTo: async ({ x, y }: GroundPoint) => {
      log.push(`moveTo:${x},${y}`)
    },
  }

  return stub as unknown as ClawController
}

/** Дублёр тикера: игровые выдержки проходят мгновенно, но остаются видимыми в журнале. */
const createTickerStub = (log: ClawLog): GameTicker => {
  const stub = {
    waitTicks: async () => {
      log.push('hold')
    },
  }

  return stub as unknown as GameTicker
}

/**
 * Собирает цикл без единого PIXI-объекта: настоящие автомат, фазы и стор.
 * Подменены только клешня и тикер. Автомат не запускается — это делает `startCycle`.
 */
export const createCycle = (): Cycle => {
  const container = new Container({ defaultScope: 'Singleton' })

  // Движок автомата и состав цикла биндятся теми же функциями, что и в композиции игры
  bindFsm(container)
  bindFlow(container)

  const log: ClawLog = []

  container.bind(TOYBOX_TOKENS.ClawController).toConstantValue(createClawStub(log))
  container.bind(ENGINE_TOKENS.GameTicker).toConstantValue(createTickerStub(log))

  const fsm = container.get(CORE_TOKENS.Fsm)
  const store = container.get(TOYBOX_TOKENS.ToyboxStore)
  const emitter = container.get(TOYBOX_TOKENS.GameEmitter)

  return {
    container,
    fsm,
    store,
    emitter,
    log,
    waitForPhase: async (phase: PhaseName) => {
      await when(() => store.phase === phase)
    },
    requestDrop: () => emitter.emit('ui:dropRequested'),
    stop: async () => {
      fsm.dispose()
      await container.unbindAll()
    },
  }
}

/** Собирает цикл и доводит его до покоя: игра готова принять опускание. */
export const startCycle = async (): Promise<Cycle> => {
  const cycle = createCycle()
  const booted = cycle.emitter.waitFor('game:booted', { timeoutMs: 5000 })
  const started = cycle.fsm.start()

  await booted
  await cycle.waitForPhase(PhaseName.idle)

  return { ...cycle, started }
}
