import { Container } from 'inversify'
import { type MockInstance, vi } from 'vitest'

import { bindFlow } from '#src/bindings'
import type { ClawRig } from '#src/claw/claw-rig'
import { HEAP_SNAPSHOT_VERSION } from '#src/constants'
import type { PrizeOutputController } from '#src/controllers/box/prize-output'
import type { GameEvents } from '#src/events'
import type { Heap } from '#src/heap/heap'
import type { ToyboxStore } from '#src/stores/toybox'
import { TOYBOX_TOKENS } from '#src/tokens'
import {
  type GroundPoint,
  type HeapSnapshot,
  type HeapSnapshotBody,
  PhaseName,
  type ToyAppearance,
  type WorldPoint,
} from '#src/types'
import { bindFsm } from '@pixi-demos/core/bindings'
import type { Notice } from '@pixi-demos/core/errors/types'
import { onNotice } from '@pixi-demos/core/errors/utils'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { Fsm } from '@pixi-demos/core/fsm/fsm'
import type { PhaseSink } from '@pixi-demos/core/fsm/types'
import type { IdbStorage } from '@pixi-demos/core/idb-storage'
import { CORE_TOKENS } from '@pixi-demos/core/tokens'
import type { Random } from '@pixi-demos/core/types'
import { GameTicker } from '@pixi-demos/engine/game-ticker'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/** Кадр игры при 60 fps. */
const FRAME_MS = 1000 / 60

/** Предохранитель: условие, которое не наступило за столько игрового времени, считается недостижимым. */
const MAX_WAIT_MS = 60_000

export type CycleOptions = {
  /** Куча в сохранённом снимке: сцена руками или насыпанная куча. */
  bodies?: HeapSnapshotBody[]
  /** Счёт в сохранённом снимке. */
  collected?: number
  /** Сырое значение хранилища вместо снимка из `bodies` и `collected`: так проверяется несовместимый снимок. */
  stored?: unknown
  /** Источник бросков после очереди `rolls`; по умолчанию 0.5 — захват без срыва и потери. */
  random?: Random
}

/** Кадр цикла: фаза и точки клешни после кадрового шага моделей. */
export type CycleFrame = {
  readonly phase: PhaseName
  readonly cart: WorldPoint
  readonly grip: WorldPoint
  readonly holding: boolean
}

/** Потеря игрушки на ходу: фаза и точки клешни в момент, когда она разжалась. */
export type CycleDrop = {
  readonly phase: PhaseName
  readonly cart: WorldPoint
  readonly grip: WorldPoint
}

export type Cycle = {
  container: Container
  fsm: Fsm
  store: ToyboxStore
  heap: Heap
  rig: ClawRig
  emitter: GameEmitter<GameEvents>
  /** Значения `Math.random` по очереди; пустая очередь отдаёт `random` из опций. */
  rolls: number[]
  /** Фазы в порядке входа, повторный вход в ту же фазу — отдельной записью. */
  phases: PhaseName[]
  /** Кадры с начала цикла. */
  frames: CycleFrame[]
  drops: CycleDrop[]
  /** Показанные призы и счёт в момент показа. */
  prizes: Array<ToyAppearance & { readonly collected: number }>
  /** Порядок презентации приза: методы окна выдачи и событие `prize:taken`. */
  presentation: string[]
  /** Записи в хранилище по порядку. */
  writes: HeapSnapshot[]
  /** Хранилище, которое читает стартовая фаза: его же получает `PersistenceController` в тесте. */
  storage: IdbStorage<HeapSnapshot>
  /** Запускает автомат и ждёт покоя: игра готова принять опускание. */
  start: () => Promise<void>
  /** Крутит кадры игры, пока условие не выполнится. */
  runUntil: (done: () => boolean) => Promise<void>
  /** Опускает клешню и проводит раунд до нового покоя; отвечает фазами раунда. */
  playRound: () => Promise<PhaseName[]>
  /** Подводит каретку к точке поля и ждёт, пока клешня перестанет качаться: так игрок выбирает игрушку. */
  moveCart: (target: GroundPoint) => Promise<void>
  stop: () => Promise<void>
}

/** Сбрасывает очередь микрозадач: цепочки `await` в фазах и автомате доходят до следующего ожидания. */
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

/**
 * Собирает цикл без единого PIXI-объекта на сцене: настоящие автомат, фазы, стор, модели кучи и клешни и
 * игровой тикер, который тест крутит кадрами. Кадр повторяет шаг `CubeController`: ход клешни, затем шаг кучи
 * за точкой захвата, и только потом ожидания фаз. Дублёры стоят на границах: хранилище в памяти и окно выдачи,
 * которое только записывает, что ему показали. Автомат не запускается — это делает `start`.
 */
export const createCycle = (options: CycleOptions = {}): Cycle => {
  const container = new Container({ defaultScope: 'Singleton' })

  // Движок автомата и состав цикла биндятся теми же функциями, что и в композиции игры
  bindFsm(container)
  bindFlow(container)

  const ticker = new GameTicker()
  const rolls: number[] = []
  const phases: PhaseName[] = []
  const frames: CycleFrame[] = []
  const drops: CycleDrop[] = []
  const prizes: Cycle['prizes'] = []
  const presentation: string[] = []
  const writes: HeapSnapshot[] = []
  const notices: Notice[] = []
  const stored = Object.hasOwn(options, 'stored')
    ? options.stored
    : { version: HEAP_SNAPSHOT_VERSION, collected: options.collected ?? 0, bodies: options.bodies ?? [] }
  const storage = {
    read: async () => structuredClone(stored),
    write: async (snapshot: HeapSnapshot) => {
      writes.push(structuredClone(snapshot))
    },
  } as unknown as IdbStorage<HeapSnapshot>

  container.bind(ENGINE_TOKENS.GameTicker).toConstantValue(ticker)
  container.rebind(TOYBOX_TOKENS.HeapStorage).toConstantValue(storage)
  container.rebind(CORE_TOKENS.PhaseSink).toDynamicValue(({ get }): PhaseSink => {
    const toyboxStore = get(TOYBOX_TOKENS.ToyboxStore)

    return {
      setPhase: (phase: PhaseName) => {
        phases.push(phase)
        toyboxStore.setPhase(phase)
      },
    } as PhaseSink
  })

  const store = container.get(TOYBOX_TOKENS.ToyboxStore)

  container.bind(TOYBOX_TOKENS.PrizeOutputController).toConstantValue({
    show: (appearance: ToyAppearance) => {
      prizes.push({ ...appearance, collected: store.collected })
      presentation.push('show')
    },
    open: async () => {
      presentation.push('open')
    },
    take: async () => {
      presentation.push('take')
    },
    close: async () => {
      presentation.push('close')
    },
    hide: () => {
      presentation.push('hide')
    },
  } as unknown as PrizeOutputController)

  const fsm = container.get(CORE_TOKENS.Fsm)
  const heap = container.get(TOYBOX_TOKENS.Heap)
  const rig = container.get(TOYBOX_TOKENS.ClawRig)
  const emitter = container.get(TOYBOX_TOKENS.GameEmitter)
  const fallback = options.random ?? (() => 0.5)
  // Исходы раунда задаёт сам тест очередью бросков
  const random = vi.spyOn(Math, 'random').mockImplementation(() => rolls.shift() ?? fallback())
  const release = heap.release.bind(heap)
  const releaseSpy: MockInstance<Heap['release']> = vi.spyOn(heap, 'release').mockImplementation((grip) => {
    drops.push({ phase: store.phase, cart: rig.getCartPoint(), grip })
    release(grip)
  })
  const offNotice = onNotice((notice) => notices.push(notice))
  const offTaken = emitter.on('prize:taken', () => presentation.push('prize:taken'))

  ticker.add((current) => {
    rig.advance(current.deltaMS, store.direction)
    heap.advance(current.deltaMS, rig.getGripPoint())
    frames.push({ phase: store.phase, cart: rig.getCartPoint(), grip: rig.getGripPoint(), holding: heap.isHolding })
  })

  let time = 0

  ticker.update(time)

  const runUntil = async (done: () => boolean): Promise<void> => {
    await flush()

    for (let waited = 0; !done(); waited += FRAME_MS) {
      if (notices.length > 0) throw new Error(`Game stopped: ${JSON.stringify(notices)}`)
      if (waited > MAX_WAIT_MS) throw new Error('Condition was not reached')

      time += FRAME_MS
      ticker.update(time)
      await flush()
    }
  }

  return {
    container,
    fsm,
    store,
    heap,
    rig,
    emitter,
    rolls,
    phases,
    frames,
    drops,
    prizes,
    presentation,
    writes,
    storage,
    start: async () => {
      void fsm.start()
      await runUntil(() => store.phase === PhaseName.idle)
    },
    runUntil,
    playRound: async () => {
      const from = phases.length

      emitter.emit('ui:dropRequested')
      await runUntil(() => phases.length > from && store.phase === PhaseName.idle)

      return phases.slice(from)
    },
    moveCart: async (target: GroundPoint) => {
      let arrived = false
      const motion = (async () => {
        await rig.moveTo(target)
        arrived = true
      })()

      await runUntil(() => {
        const cart = rig.getCartPoint()
        const grip = rig.getGripPoint()

        return arrived && grip.x === cart.x && grip.y === cart.y
      })
      await motion
    },
    stop: async () => {
      fsm.dispose()
      await flush()
      offTaken()
      offNotice()
      random.mockRestore()
      releaseSpy.mockRestore()
      ticker.destroy()
      await container.unbindAll()
    },
  }
}

/** Собирает цикл и доводит его до покоя: игра готова принять опускание. */
export const startCycle = async (options: CycleOptions = {}): Promise<Cycle> => {
  const cycle = createCycle(options)

  await cycle.start()

  return cycle
}

/**
 * Броски, на которых захват игрушки под кареткой удаётся и проваливается. Шанс зависит от формы и нагрузки
 * сверху, поэтому тест берёт его у самой кучи.
 */
export const getGrabRolls = (cycle: Cycle): { hit: number; miss: number } => {
  const chance = cycle.heap.getGrabChance(cycle.rig.getCartPoint())

  return { hit: chance / 2, miss: (1 + chance) / 2 }
}
