import { Container } from 'inversify'
import { when } from 'mobx'
import { vi } from 'vitest'

import { bindFlow } from '#src/bindings'
import { FIELD_CENTER, HEAP_SNAPSHOT_VERSION, CLAW_REST_HEIGHT, CUBE_HEIGHT } from '#src/constants'
import type { ClawController } from '#src/controllers/box/claw'
import type { PrizeOutputController } from '#src/controllers/box/prize-output'
import type { GameEvents } from '#src/events'
import { Heap } from '#src/heap/heap'
import { getGrabChance } from '#src/heap/utils'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import {
  type ClawDrop,
  type GroundPoint,
  type HeapSnapshot,
  PhaseName,
  type ToyAppearance,
  type WorldPoint,
} from '#src/types'
import { getWeight } from '#src/utils/shapes'
import { bindFsm } from '@pixi-demos/core/bindings'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { Fsm } from '@pixi-demos/core/fsm/fsm'
import type { IdbStorage } from '@pixi-demos/core/idb-storage'
import { createRandom } from '@pixi-demos/core/random'
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
  heap: Heap
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
  /** Точки, над которыми клешня уронила игрушку по дороге к лотку. */
  drops: GroundPoint[]
}

/** Сид кучи, над которой идут сценарии цикла. */
const CYCLE_SEED = 7

let cycleSnapshot: HeapSnapshot | undefined

/**
 * Куча сценариев, насыпанная по сиду. В цикле `Math.random` отвечает очередью бросков теста, поэтому
 * кучу стартовой фазе отдаёт дублёр хранилища.
 */
const getCycleSnapshot = (): HeapSnapshot => {
  if (!cycleSnapshot) {
    const heap = new Heap()

    heap.restore(undefined, createRandom(CYCLE_SEED))
    cycleSnapshot = heap.takeSnapshot(0)
  }

  return cycleSnapshot
}

/**
 * Дублёр клешни: движения завершаются сразу, но остаются видимыми в журнале.
 * Положение он ведёт по-настоящему — по нему фазы находят игрушку под клешнёй.
 */
const createClawStub = (log: ClawLog, drops: GroundPoint[]): ClawController => {
  let position: GroundPoint = FIELD_CENTER
  let z = CLAW_REST_HEIGHT

  const stub = {
    getCartPoint: () => ({ ...position, z: CUBE_HEIGHT }),
    getGripPoint: () => ({ ...position, z }),
    descend: async (toZ: number) => {
      z = toZ
      log.push(`descend:${toZ}`)
    },
    grab: async (onProgress: (progress: number, grip: WorldPoint) => void) => {
      onProgress(1, { ...position, z })
      log.push('grab')
    },
    ascend: async (slip: ClawDrop | undefined) => {
      log.push(slip ? 'ascend slip' : 'ascend')
      if (slip) slip.onDrop({ ...position, z: z + (CLAW_REST_HEIGHT - z) * slip.share })
      z = CLAW_REST_HEIGHT
    },
    moveTo: async (target: GroundPoint) => {
      position = target
      log.push(`moveTo:${target.x},${target.y}`)
    },
    carryTo: async (target: GroundPoint, drop: ClawDrop | undefined) => {
      const at = drop ? {
        x: position.x + (target.x - position.x) * drop.share,
        y: position.y + (target.y - position.y) * drop.share,
        z,
      } : undefined

      log.push(`carryTo:${target.x},${target.y}${at ? ' drop' : ''}`)
      if (drop && at) {
        drops.push({ x: at.x, y: at.y })
        drop.onDrop(at)
      }
      position = target
    },
  }

  return stub as unknown as ClawController
}

/**
 * Дублёр тикера: игровые выдержки проходят мгновенно, но остаются видимыми в журнале. Ожидание условия
 * продвигает настоящую модель кучи кадрами по 100 мс, пока условие не выполнится.
 */
const createTickerStub = (log: ClawLog, getHeap: () => Heap): GameTicker => {
  const stub = {
    waitTicks: async (durationMs: number) => {
      log.push(`wait:${durationMs}`)
      getHeap().advance(durationMs)
    },
    waitUntil: async (ready: () => boolean) => {
      for (let frame = 0; frame < 10_000 && !ready(); frame++) getHeap().advance(100)
      if (!ready()) throw new Error('Condition was not reached')
    },
  }

  return stub as unknown as GameTicker
}

/**
 * Собирает цикл без единого PIXI-объекта: настоящие автомат, фазы, стор и модель кучи.
 * Дублёры клешни, тикера и окна выдачи завершают операции сразу.
 * Ожидание условия в дублёре тикера продвигает настоящую модель до результата.
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
  const drops: GroundPoint[] = []

  container.bind(TOYBOX_TOKENS.ClawController).toConstantValue(createClawStub(log, drops))
  container.rebind(TOYBOX_TOKENS.HeapStorage).toConstantValue({
    read: async () => structuredClone(getCycleSnapshot()),
    write: async () => {},
  } as unknown as IdbStorage<HeapSnapshot>)
  container
    .bind(ENGINE_TOKENS.GameTicker)
    .toConstantValue(createTickerStub(log, () => container.get(TOYBOX_TOKENS.Heap)))
  container.bind(TOYBOX_TOKENS.PrizeOutputController).toConstantValue({
    show: (appearance: ToyAppearance) => {
      const { collected } = container.get(TOYBOX_TOKENS.ToyboxStore)

      prizes.push({ ...appearance, collected, domainCollected: collected })
    },
    open: async () => { log.push('prize:open') },
    take: async () => { log.push('prize:take') },
    close: async () => { log.push('prize:close') },
    hide: () => {},
  } as unknown as PrizeOutputController)

  // Исход захвата и потери задаёт сам тест очередью бросков
  const random = vi.spyOn(Math, 'random').mockImplementation(() => world.rolls.shift() ?? 0.5)

  const fsm = container.get(CORE_TOKENS.Fsm)
  const store = container.get(TOYBOX_TOKENS.ToyboxStore)
  const heap = container.get(TOYBOX_TOKENS.Heap)
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
    drops,
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

/**
 * Броски, на которых захват игрушки под клешнёй удаётся и проваливается. Шанс теперь зависит от
 * формы и нагрузки сверху, поэтому тест берёт его у самой кучи, а не у константы.
 */
export const getGrabRolls = (cycle: Cycle): { hit: number; miss: number } => {
  const body = cycle.heap.getTopBodyAt(FIELD_CENTER)

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
