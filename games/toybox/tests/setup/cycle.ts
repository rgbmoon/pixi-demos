import { Container } from 'inversify'
import { when } from 'mobx'
import { vi } from 'vitest'

import { bindFlow } from '#src/bindings'
import { FIELD_CENTER, HEAP_SNAPSHOT_VERSION } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { PrizeOutputController } from '#src/controllers/box/prize-output'
import type { GameEvents } from '#src/events'
import type { HeapStore } from '#src/stores/heap'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import {
  type ClawDrop,
  type ClawSlip,
  type GroundPoint,
  PhaseName,
  type ToyAppearance,
  type ToyId,
} from '#src/types'
import { getGrabChance, getWeight } from '#src/utils/heap'
import { toCell } from '#src/utils/projection'
import { bindFsm } from '@pixi-demos/core/bindings'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { Fsm } from '@pixi-demos/core/fsm/fsm'
import { CORE_TOKENS } from '@pixi-demos/core/tokens'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/** Порядок движений и выдержек в том виде, в котором их запросили фазы. */
export type ClawLog = string[]

/** Что дублёры отвечают фазам: очередь бросков, которой тест задаёт исходы. */
export type CycleWorld = {
  /** Значения `Math.random` по очереди: пустая очередь отдаёт 0.5. */
  rolls: number[]
}

export type Cycle = {
  container: Container
  fsm: Fsm
  store: ToyboxStore
  heap: HeapStore
  emitter: GameEmitter<GameEvents>
  log: ClawLog
  world: CycleWorld
  prizes: Array<ToyAppearance & { readonly collected: number; readonly domainCollected: number }>
  /** Ждёт, когда автомат объявит указанную фазу. */
  waitForPhase: (phase: PhaseName) => Promise<void>
  requestDrop: () => void
  stop: () => Promise<void>
  /** Промис петли автомата: резолвится, когда автомат вышел. */
  started?: Promise<void>
}

/**
 * Дублёр клешни: движения завершаются сразу, но остаются видимыми в журнале.
 * Положение он ведёт по-настоящему — по нему фазы считают ячейку под клешнёй.
 */
const createClawStub = (log: ClawLog): ClawController => {
  let position: GroundPoint = FIELD_CENTER
  let carried: ToyId | undefined

  const stub = {
    getPosition: () => position,
    getCell: () => toCell(position),
    getCarryPoint: () => undefined,
    descend: async (toZ: number) => {
      log.push(`descend:${toZ}`)
    },
    ascend: async (slip: ClawSlip | undefined) => {
      log.push(slip ? 'ascend slip' : 'ascend')

      if (!slip || carried === undefined) return

      const id = carried

      carried = undefined
      slip.onDrop(id)
    },
    moveTo: async (target: GroundPoint) => {
      position = target
      log.push(`moveTo:${target.x},${target.y}`)
    },
    carryTo: async (target: GroundPoint, drop: ClawDrop | undefined) => {
      position = target
      log.push(`carryTo:${target.x},${target.y}${drop ? ` drop:${drop.cell.col},${drop.cell.row}` : ''}`)

      if (!drop || carried === undefined) return

      const id = carried

      carried = undefined
      drop.onDrop(id)
    },
    isHolding: () => carried !== undefined,
    hold: (id: ToyId) => {
      carried = id
      log.push('hold')
    },
    release: () => {
      const id = carried

      carried = undefined

      if (id !== undefined) log.push('release')

      return id
    },
  }

  return stub as unknown as ClawController
}

/** Дублёр тикера: игровые выдержки проходят мгновенно, но остаются видимыми в журнале. */
const createTickerStub = (log: ClawLog, getHeap: () => HeapStore): GameTicker => {
  const stub = {
    waitTicks: async (durationMs: number) => {
      log.push(`wait:${durationMs}`)
      getHeap().advance(durationMs)
    },
  }

  return stub as unknown as GameTicker
}

/**
 * Собирает цикл без единого PIXI-объекта: настоящие автомат, фазы, стор и модель кучи.
 * Подменены клешня, тикер и `Math.random`. Кадровый шаг кучи никто не крутит — фазы меняют
 * решётку сразу, а движение разыгрывалось бы только на тикере.
 * Автомат не запускается — это делает `startCycle`.
 */
export const createCycle = (): Cycle => {
  const container = new Container({ defaultScope: 'Singleton' })

  // Движок автомата и состав цикла биндятся теми же функциями, что и в композиции игры
  bindFsm(container)
  bindFlow(container)

  const log: ClawLog = []
  const world: CycleWorld = { rolls: [] }
  const prizes: Cycle['prizes'] = []

  container.bind(TOYBOX_TOKENS.ClawController).toConstantValue(createClawStub(log))
  container
    .bind(ENGINE_TOKENS.GameTicker)
    .toConstantValue(createTickerStub(log, () => container.get(TOYBOX_TOKENS.HeapStore)))
  container.bind(TOYBOX_TOKENS.PrizeOutputController).toConstantValue({
    present: async (appearance: ToyAppearance, collected: number) => {
      prizes.push({ ...appearance, collected, domainCollected: container.get(TOYBOX_TOKENS.ToyboxStore).collected })
    },
  } as unknown as PrizeOutputController)

  // Исход захвата и потери задаёт сам тест очередью бросков
  const random = vi.spyOn(Math, 'random').mockImplementation(() => world.rolls.shift() ?? 0.5)

  const fsm = container.get(CORE_TOKENS.Fsm)
  const store = container.get(TOYBOX_TOKENS.ToyboxStore)
  const heap = container.get(TOYBOX_TOKENS.HeapStore)
  const emitter = container.get(TOYBOX_TOKENS.GameEmitter)

  return {
    container,
    fsm,
    store,
    heap,
    emitter,
    log,
    world,
    prizes,
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

/** Ячейка, над которой стоит клешня в покое. */
export const getHomeCell = () => toCell(FIELD_CENTER)

/**
 * Броски, на которых захват игрушки под клешнёй удаётся и проваливается. Шанс теперь зависит от
 * формы и нагрузки сверху, поэтому тест берёт его у самой кучи, а не у константы.
 */
export const getGrabRolls = (cycle: Cycle): { hit: number; miss: number } => {
  const body = cycle.heap.getTopBody(getHomeCell())

  if (!body) return { hit: 0, miss: 1 }

  const chance = getGrabChance(getWeight(body.shape), cycle.heap.getLoad(body.id))

  return { hit: chance / 2, miss: (1 + chance) / 2 }
}

/** Опустошает куб: так проверяется цикл над пустой ячейкой. */
export const emptyHeap = (cycle: Cycle): void => {
  cycle.heap.restore({ version: HEAP_SNAPSHOT_VERSION, collected: 0, bodies: [] }, Math.random)
}

/** Сколько игрушек лежит в куче: та, что уходит в лоток, в ней уже не числится. */
export const countToys = (cycle: Cycle): number => cycle.heap.takeSnapshot(0).bodies.length
