import { Container } from 'inversify'
import { when } from 'mobx'
import { vi } from 'vitest'

import { bindFlow } from '#src/bindings'
import { FIELD_CENTER } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { ContentsController } from '#src/controllers/box/contents'
import type { GameEvents } from '#src/events'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import { type ClawDrop, type GroundPoint, PhaseName } from '#src/types'
import type { Toy } from '#src/ui/box/toy'
import { toCell } from '#src/utils'
import { bindFsm } from '@pixi-demos/core/bindings'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { Fsm } from '@pixi-demos/core/fsm/fsm'
import { CORE_TOKENS } from '@pixi-demos/core/tokens'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/** Порядок движений и выдержек в том виде, в котором их запросили фазы. */
export type ClawLog = string[]

/** Что дублёры отвечают фазам: поле под клешнёй, исход падения и очередь бросков. */
export type CycleWorld = {
  /** Сколько слоёв занято в ячейке, куда садится клешня. */
  stackHeight: number
  /** Уходит ли упавшая по дороге игрушка в лоток. */
  dropCollected: boolean
  /** Значения `Math.random` по очереди: пустая очередь отдаёт 0.5. */
  rolls: number[]
}

export type Cycle = {
  container: Container
  fsm: Fsm
  store: ToyboxStore
  emitter: GameEmitter<GameEvents>
  log: ClawLog
  world: CycleWorld
  /** Ждёт, когда автомат объявит указанную фазу. */
  waitForPhase: (phase: PhaseName) => Promise<void>
  requestDrop: () => void
  stop: () => Promise<void>
  /** Промис петли автомата: резолвится, когда автомат вышел. */
  started?: Promise<void>
}

/** Игрушка глазами цикла: фазы её не читают, а только передают из рук в руки. */
const createToyStub = (): Toy => ({}) as Toy

/**
 * Дублёр клешни: движения завершаются сразу, но остаются видимыми в журнале.
 * Положение он ведёт по-настоящему — по нему фазы считают ячейку под клешнёй.
 */
const createClawStub = (log: ClawLog): ClawController => {
  let position: GroundPoint = FIELD_CENTER
  let carried: Toy | undefined

  const stub = {
    getPosition: () => position,
    getCell: () => toCell(position),
    descend: async (toZ: number) => {
      log.push(`descend:${toZ}`)
    },
    ascend: async () => {
      log.push('ascend')
    },
    moveTo: async (target: GroundPoint) => {
      position = target
      log.push(`moveTo:${target.x},${target.y}`)
    },
    carryTo: async (target: GroundPoint, drop: ClawDrop | undefined) => {
      position = target
      log.push(`carryTo:${target.x},${target.y}${drop ? ` drop:${drop.cell.col},${drop.cell.row}` : ''}`)

      if (!drop || !carried) return

      const toy = carried

      carried = undefined
      drop.onDrop(toy)
    },
    isHolding: () => carried !== undefined,
    hold: (toy: Toy) => {
      carried = toy
      log.push('hold')
    },
    release: () => {
      const toy = carried

      carried = undefined

      if (toy) log.push('release')

      return toy
    },
  }

  return stub as unknown as ClawController
}

/** Дублёр содержимого куба: стопок не держит, отвечает по `world` и пишет запросы фаз в журнал. */
const createContentsStub = (log: ClawLog, world: CycleWorld): ContentsController => {
  const stub = {
    getStackHeight: () => world.stackHeight,
    take: ({ col, row }: { col: number; row: number }) => {
      log.push(`take:${col},${row}`)

      return world.stackHeight > 0 ? createToyStub() : undefined
    },
    drop: (_toy: Toy, { col, row }: { col: number; row: number }) => {
      log.push(`drop:${col},${row}`)

      return world.dropCollected
    },
    settle: () => {
      log.push('settle')
    },
    collect: async () => {
      log.push('collect')
    },
  }

  return stub as unknown as ContentsController
}

/** Дублёр тикера: игровые выдержки проходят мгновенно, но остаются видимыми в журнале. */
const createTickerStub = (log: ClawLog): GameTicker => {
  const stub = {
    waitTicks: async (durationMs: number) => {
      log.push(`wait:${durationMs}`)
    },
  }

  return stub as unknown as GameTicker
}

/**
 * Собирает цикл без единого PIXI-объекта: настоящие автомат, фазы и стор.
 * Подменены клешня, содержимое куба, тикер и `Math.random`. Автомат не запускается — это делает
 * `startCycle`.
 */
export const createCycle = (): Cycle => {
  const container = new Container({ defaultScope: 'Singleton' })

  // Движок автомата и состав цикла биндятся теми же функциями, что и в композиции игры
  bindFsm(container)
  bindFlow(container)

  const log: ClawLog = []
  const world: CycleWorld = { stackHeight: 3, dropCollected: false, rolls: [] }

  container.bind(TOYBOX_TOKENS.ClawController).toConstantValue(createClawStub(log))
  container.bind(TOYBOX_TOKENS.ContentsController).toConstantValue(createContentsStub(log, world))
  container.bind(ENGINE_TOKENS.GameTicker).toConstantValue(createTickerStub(log))

  // Исход захвата и потери задаёт сам тест очередью бросков
  const random = vi.spyOn(Math, 'random').mockImplementation(() => world.rolls.shift() ?? 0.5)

  const fsm = container.get(CORE_TOKENS.Fsm)
  const store = container.get(TOYBOX_TOKENS.ToyboxStore)
  const emitter = container.get(TOYBOX_TOKENS.GameEmitter)

  return {
    container,
    fsm,
    store,
    emitter,
    log,
    world,
    waitForPhase: async (phase: PhaseName) => {
      await when(() => store.phase === phase)
    },
    requestDrop: () => emitter.emit('ui:dropRequested'),
    stop: async () => {
      fsm.dispose()
      random.mockRestore()
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
