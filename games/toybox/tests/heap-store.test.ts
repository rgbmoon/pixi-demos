// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import {
  GRID_SIZE,
  HEAP_SNAPSHOT_VERSION,
  MAX_LAYERS,
  TRAY_CENTER,
  TRAY_EXIT_Z,
  TRAY_ORIGIN,
  TRAY_SLIDE_DELAY_MS,
  TRAY_WALL_LAYERS,
} from '#src/constants'
import { HeapStore } from '#src/stores/heap'
import {
  type CellAddress,
  type HeapSnapshot,
  type Occupancy,
  type ToyBody,
  type ToyId,
  ToyState,
  type VolumeCell,
} from '#src/types'
import { isBoxCell } from '#src/utils/heap'
import { getMotionMs } from '#src/utils/motion'
import { getCellCenter, isTrayCell } from '#src/utils/projection'
import { getBottomCells, getPlacementCells, getWeight } from '#src/utils/shapes'
import { createRandom } from '@pixi-demos/core/random'
import type { Random } from '@pixi-demos/core/types'

const OUT_OF_GRID = new Set<ToyState>([ToyState.carried, ToyState.slidingToTray, ToyState.fallingIntoTray])

const grip = (heap: HeapStore) => {
  const carried = [...heap.getBodies()].find((body) => body.state === ToyState.carried)

  if (!carried) throw new Error('No carried toy')

  return { ...carried.pose.point }
}
const lift = (heap: HeapStore, cell: CellAddress) =>
  heap.lift(cell, heap.getTopBody(cell)?.pose.point ?? { x: 0, y: 0, z: 0 })

const FRAME_MS = 1000 / 60
const STRESS_FRAME_MS = 100
/** Предохранитель: куча, которая не встала за столько кадров, считается зациклившейся. */
const MAX_FRAMES = 10_000

/** Крутит кадры, пока куча не придёт в покой; отвечает, сколько кадров на это ушло. */
const settle = (heap: HeapStore, deltaMs = FRAME_MS): number => {
  for (let frame = 1; frame <= MAX_FRAMES; frame++) {
    heap.advance(deltaMs)

    if (heap.settled) return frame
  }

  throw new Error('Heap never settled')
}

/** Все занятые клетки кучи, как они выводятся из её игрушек. */
const getCells = (heap: HeapStore): VolumeCell[] =>
  [...heap.getBodies()]
    .filter((body) => !OUT_OF_GRID.has(body.state))
    .flatMap((body) => getPlacementCells(body.shape, body.placement.facing, body.placement.anchor, body.placement.layer))

const toKey = ({ col, row, layer }: VolumeCell): string => `${col}:${row}:${layer}`

const createOccupancy = (cells: readonly VolumeCell[]): Occupancy => {
  const taken = new Set(cells.map(toKey))

  return (cell: VolumeCell) => taken.has(toKey(cell))
}

/**
 * Стоит ли игрушка хоть на чём-то: под одной из её нижних клеток пол или другая игрушка.
 *
 * Это ровно то, что модель гарантирует. Более сильное правило `isSupported` (опора под половиной
 * нижних клеток) выполняется не всегда: длинная форма, из-под которой увели все опоры кроме одного
 * столбика, опуститься не может и остаётся заклиненной.
 */
const isGrounded = (body: Readonly<ToyBody>, isOccupied: Occupancy): boolean => {
  const cells = getPlacementCells(body.shape, body.placement.facing, body.placement.anchor, body.placement.layer)

  return getBottomCells(cells).some(({ col, row, layer }) => layer === 0 || isOccupied({ col, row, layer: layer - 1 }))
}

/** Проверяет всё, что обязано быть верно про кучу в покое. */
const expectSoundHeap = (heap: HeapStore): void => {
  const bodies = [...heap.getBodies()].filter((body) => !OUT_OF_GRID.has(body.state))
  const cells = getCells(heap)
  const keys = cells.map(toKey)
  const isOccupied = createOccupancy(cells)

  // Ни одна клетка не занята дважды, и занятых ровно столько, сколько весят все игрушки
  expect(new Set(keys).size).toBe(keys.length)
  expect(cells).toHaveLength(bodies.reduce((sum, body) => sum + getWeight(body.shape), 0))
  expect(cells.every(isBoxCell)).toBe(true)
  expect(cells.every((cell) => !isTrayCell(cell))).toBe(true)

  const ungrounded = bodies
    .filter((body) => body.state === ToyState.resting && !isGrounded(body, isOccupied))
    .map((body) => body.id)

  expect(ungrounded).toEqual([])
}

/** Куча из снимка: тесты, которым нужна известная раскладка, строят её руками. */
const createHeap = (bodies: HeapSnapshot['bodies']): HeapStore => {
  const heap = new HeapStore()

  heap.restore({ version: HEAP_SNAPSHOT_VERSION, collected: 0, bodies }, createRandom(1))

  return heap
}

/** Куча, наполненная куполом по сиду. */
const createFilledHeap = (seed: number): HeapStore => {
  const heap = new HeapStore()

  heap.restore(undefined, createRandom(seed))

  return heap
}

const TRAY_EDGE = { col: TRAY_ORIGIN.col, row: TRAY_ORIGIN.row - 1 }

const createStackByTray = (random: Random): HeapStore => {
  const heap = new HeapStore()

  heap.restore(
    {
      version: HEAP_SNAPSHOT_VERSION,
      collected: 0,
      bodies: [0, 1, 2].map((layer) => ({
        shape: 'single' as const,
        facing: 0 as const,
        anchor: TRAY_EDGE,
        layer,
        color: 1,
      })),
    },
    random
  )

  return heap
}

const createTrayHitRandom = (): Random => {
  let first = true

  return () => {
    if (!first) return 0.99

    first = false

    return 0
  }
}

describe('HeapStore: наполнение', () => {
  it('создаёт новую смешанную раскладку при каждом наполнении', () => {
    const heap = new HeapStore()
    const seen = new Set<ToyId>()
    const layouts = new Set<string>()

    for (const seed of [1, 2, 3]) {
      heap.restore(undefined, createRandom(seed))

      const bodies = [...heap.getBodies()]
      const shapes = new Set(bodies.map((body) => body.shape))
      const barAxes = new Set(bodies.filter((body) => body.shape === 'bar2').map((body) => body.placement.facing % 2))

      expect(shapes.size).toBeGreaterThanOrEqual(3)
      expect(barAxes).toEqual(new Set([0, 1]))

      layouts.add(
        bodies
          .map((body) => `${body.shape}:${body.placement.facing % 2}:${body.placement.anchor.col},${body.placement.anchor.row},${body.placement.layer}`)
          .sort()
          .join('|')
      )

      for (const body of bodies) {
        expect(seen.has(body.id)).toBe(false)
        seen.add(body.id)
      }
    }

    expect(layouts.size).toBe(3)
    expect(seen.size).toBeGreaterThan(100)
  })

  it('складывает связную кучу из разных форм', () => {
    const heap = createFilledHeap(1)
    const shapes = new Set([...heap.getBodies()].map((body) => body.shape))

    expect([...heap.getBodies()].length).toBeGreaterThan(20)
    expect(shapes.size).toBeGreaterThan(1)
    expectSoundHeap(heap)
  })

  it('оставляет наполненную кучу в покое: сама по себе она не едет', () => {
    const heap = createFilledHeap(2)

    expect(heap.settled).toBe(true)
    expect(settle(heap)).toBe(1)
    expectSoundHeap(heap)
  })

  it('не наполняет лоток и не выходит за пределы куба', () => {
    for (const seed of [3, 4, 5]) {
      const heap = createFilledHeap(seed)

      for (const cell of getCells(heap)) {
        expect(isBoxCell(cell)).toBe(true)
      }
    }
  })
})

describe('HeapStore: изъятие из-под штабеля', () => {
  /** Полоса на полу и две игрушки поверх её ближнего конца. */
  const createStack = (): HeapStore =>
    createHeap([
      { shape: 'bar2', facing: 0, anchor: { col: 2, row: 2 }, layer: 0, color: 1 },
      { shape: 'single', facing: 0, anchor: { col: 2, row: 2 }, layer: 1, color: 2 },
      { shape: 'single', facing: 0, anchor: { col: 2, row: 2 }, layer: 2, color: 3 },
    ])

  it('считает нагрузкой все игрушки сверху, включая непрямые опоры', () => {
    const heap = createStack()
    const bar = heap.getTopBody({ col: 3, row: 2 })

    expect(bar?.shape).toBe('bar2')
    expect(heap.getLoad(bar?.id ?? 0)).toBe(2)
  })

  it('отдаёт клешне верхнюю игрушку столбца, а не ту, что под ней', () => {
    const heap = createStack()

    expect(heap.getTopBody({ col: 2, row: 2 })?.shape).toBe('single')
    expect(heap.getTopBody({ col: 3, row: 2 })?.shape).toBe('bar2')
  })

  it('роняет весь штабель, когда из-под него уводят опору', () => {
    const heap = createStack()

    expect(heap.getSurfaceHeight({ col: 2, row: 2 })).toBe(3)

    // Полоса открыта сверху в своём дальнем конце: там клешня до неё и дотягивается
    expect(lift(heap, { col: 3, row: 2 })).toBeDefined()

    settle(heap)

    // После удаления опоры обе верхние игрушки опускаются на пол
    expect([...heap.getBodies()].every((body) => body.placement.layer === 0)).toBe(true)
    expectSoundHeap(heap)
  })
})

describe('HeapStore: цикл клешни', () => {
  it('возвращает поднятую игрушку в кучу и оставляет её связной', () => {
    const heap = createFilledHeap(6)
    const before = [...heap.getBodies()].length
    const id = lift(heap, { col: 4, row: 4 })

    expect(id).toBeDefined()
    settle(heap)

    heap.release({ ...grip(heap), x: 6.5, y: 2.5 })
    settle(heap)

    expect([...heap.getBodies()].length).toBe(before)
    expectSoundHeap(heap)
  })

  it('засчитывает игрушку, отпущенную над лотком, и убирает её из кучи', () => {
    const heap = createFilledHeap(7)
    const before = [...heap.getBodies()].length
    lift(heap, { col: 4, row: 4 })

    settle(heap)

    heap.release({ ...grip(heap), ...TRAY_CENTER })
    expect(heap.releaseOutcome.status).not.toBe('collected')
    settle(heap)

    expect([...heap.getBodies()].length).toBe(before - 1)
    expect(heap.releaseOutcome.status).toBe('collected')
    expectSoundHeap(heap)
  })

  it('не телепортирует игрушку, отпущенную вровень со своим местом или ниже него', () => {
    const heap = createHeap(
      [0, 1, 2].map((layer) => ({ shape: 'single' as const, facing: 0 as const, anchor: { col: 4, row: 4 }, layer, color: 1 }))
    )
    const id = lift(heap, { col: 4, row: 4 }) as number

    settle(heap)

    // Клешня сорвалась у самого верха стопки и стоит ниже места, куда игрушка сядет
    heap.setGripPoint({ x: 4.5, y: 4.5, z: 1.8 })
    heap.release(grip(heap))

    heap.advance(FRAME_MS)

    const body = [...heap.getBodies()].find((candidate) => candidate.id === id)

    // Ход занял больше кадра: до правки игрушка приезжала на место за один и телепортировалась
    expect(body?.state).toBe(ToyState.falling)
    expect(settle(heap)).toBeGreaterThan(1)
    expect(body?.state).toBe(ToyState.resting)
    expectSoundHeap(heap)
  })

  describe('соскальзывание в лоток', () => {
    it('засчитывает игрушку только после достижения дна', () => {
      const heap = createStackByTray(createTrayHitRandom())
      lift(heap, TRAY_EDGE)

      expect(heap.getSurfaceHeight(TRAY_EDGE)).toBeGreaterThanOrEqual(TRAY_WALL_LAYERS)
      heap.release(grip(heap))

      expect(heap.releaseOutcome.status).not.toBe('collected')
      settle(heap)

      expect([...heap.getBodies()]).toHaveLength(2)
      expect(heap.releaseOutcome.status).toBe('collected')
    })

    it('после посадки ждёт 300 мс, движется к центру и падает вертикально', () => {
      const heap = createStackByTray(createTrayHitRandom())
      const id = lift(heap, TRAY_EDGE) as number

      heap.setGripPoint({ x: TRAY_EDGE.col + 0.5, y: TRAY_EDGE.row + 0.5, z: 3 })
      heap.release(grip(heap))

      const body = [...heap.getBodies()].find((candidate) => candidate.id === id) as ToyBody

      expect(body.state).toBe(ToyState.landingBeforeTray)
      heap.advance(body.durationMs)
      expect(body.state).toBe(ToyState.waitingForTraySlide)

      const landed = { ...body.pose.point }

      heap.advance(TRAY_SLIDE_DELAY_MS - 1)
      expect(body.state).toBe(ToyState.waitingForTraySlide)
      expect(body.pose.point).toEqual(landed)
      expect(heap.releaseOutcome.status).not.toBe('collected')

      heap.advance(1)
      expect(body.state).toBe(ToyState.slidingToTray)
      expect(body.target).toEqual({ ...TRAY_CENTER, z: landed.z })

      heap.advance(body.durationMs)
      expect(body.state).toBe(ToyState.fallingIntoTray)
      expect(body.pose.point.x).toBe(TRAY_CENTER.x)
      expect(body.pose.point.y).toBe(TRAY_CENTER.y)
      expect(body.target).toEqual({ ...TRAY_CENTER, z: TRAY_EXIT_Z })

      const fallMs = body.durationMs

      heap.advance(fallMs - 1)
      expect(heap.releaseOutcome.status).not.toBe('collected')

      heap.advance(1)
      expect([...heap.getBodies()].find((candidate) => candidate.id === id)).toBeUndefined()
      expect(heap.releaseOutcome.status).toBe('collected')
    })

    it('сохраняет задержку 300 мс при уменьшенном движении', () => {
      const heap = createStackByTray(createTrayHitRandom())
      heap.setReducedMotion(true)
      const id = lift(heap, TRAY_EDGE) as number

      heap.release(grip(heap))

      const body = [...heap.getBodies()].find((candidate) => candidate.id === id)

      expect(body?.state).toBe(ToyState.waitingForTraySlide)
      heap.advance(TRAY_SLIDE_DELAY_MS - 1)
      expect(body?.state).toBe(ToyState.waitingForTraySlide)
      expect(heap.releaseOutcome.status).not.toBe('collected')

      heap.advance(1)
      expect([...heap.getBodies()].find((candidate) => candidate.id === id)).toBeUndefined()
      expect(heap.releaseOutcome.status).toBe('collected')

    })

    it('оставляет игрушку в кубе, когда бросок перевала не прошёл', () => {
      const heap = createStackByTray(() => 0.99)
      lift(heap, TRAY_EDGE)

      heap.release(grip(heap))

      settle(heap)

      expect([...heap.getBodies()]).toHaveLength(3)
      expect(heap.releaseOutcome.status).not.toBe('collected')
      expectSoundHeap(heap)
    })

    it('не переваливает игрушку через стенку, до верха которой стопка не достаёт', () => {
      const heap = new HeapStore()

      heap.restore(
        {
          version: HEAP_SNAPSHOT_VERSION,
          collected: 0,
          bodies: [{ shape: 'single', facing: 0, anchor: TRAY_EDGE, layer: 0, color: 1 }],
        },
        () => 0
      )

      const id = lift(heap, TRAY_EDGE) as number

      expect(heap.getSurfaceHeight(TRAY_EDGE)).toBeLessThan(TRAY_WALL_LAYERS)
      heap.release(grip(heap))

      expect([...heap.getBodies()].find((body) => body.id === id)?.state).toBe(ToyState.falling)
    })

    it('учитывает все нижние клетки составной формы у стенки', () => {
      const supports: HeapSnapshot['bodies'] = []

      for (const col of [TRAY_ORIGIN.col, TRAY_ORIGIN.col + 1]) {
        for (const layer of [0, 1]) {
          supports.push({ shape: 'single', facing: 0, anchor: { col, row: TRAY_EDGE.row }, layer, color: 1 })
        }
      }

      const heap = new HeapStore()

      heap.restore(
        {
          version: HEAP_SNAPSHOT_VERSION,
          collected: 0,
          bodies: [
            ...supports,
            { shape: 'bar2', facing: 0, anchor: TRAY_EDGE, layer: TRAY_WALL_LAYERS, color: 2 },
          ],
        },
        createTrayHitRandom()
      )
      const id = lift(heap, TRAY_EDGE) as number

      heap.release(grip(heap))

      expect([...heap.getBodies()].find((body) => body.id === id)?.state).toBe(ToyState.landingBeforeTray)
    })

    it('не пропускает через стенку нижний слой cube8', () => {
      const anchor = { col: TRAY_ORIGIN.col + 2, row: TRAY_ORIGIN.row }
      const supports: HeapSnapshot['bodies'] = []

      for (const col of [anchor.col, anchor.col + 1]) {
        for (const row of [anchor.row, anchor.row + 1]) {
          supports.push({ shape: 'single', facing: 0, anchor: { col, row }, layer: 0, color: 1 })
        }
      }

      const heap = createHeap([...supports, { shape: 'cube8', facing: 0, anchor, layer: 1, color: 2 }])
      const id = lift(heap, anchor) as number

      heap.release(grip(heap))

      expect([...heap.getBodies()].find((body) => body.id === id)?.state).toBe(ToyState.falling)
    })
  })

  it('доворачивает игрушку при возврате в кучу', () => {
    const heap = createHeap([{ shape: 'bar2', facing: 0, anchor: { col: 2, row: 2 }, layer: 0, color: 1 }])
    lift(heap, { col: 2, row: 2 })

    heap.release({ ...grip(heap), x: 5.5, y: 5.5 })
    settle(heap)

    expect([...heap.getBodies()][0].placement.facing).toBe(1)
  })
})

describe('HeapStore: засыпка дыр', () => {
  /** Крутит фиксированное число кадров: засыпка идёт волнами и в паузах между ними куча стоит. */
  const advance = (heap: HeapStore, frames: number): void => {
    for (let frame = 0; frame < frames; frame++) {
      heap.advance(FRAME_MS)
    }
  }

  const getBareFloor = (heap: HeapStore): number => {
    let bare = 0

    for (let col = 0; col < GRID_SIZE; col++) {
      for (let row = 0; row < GRID_SIZE; row++) {
        if (!isTrayCell({ col, row }) && heap.getSurfaceHeight({ col, row }) === 0) bare += 1
      }
    }

    return bare
  }

  const getProfile = (heap: HeapStore): string =>
    Array.from({ length: GRID_SIZE }, (_, col) =>
      Array.from({ length: GRID_SIZE }, (_, row) => heap.getSurfaceHeight({ col, row })).join('')
    ).join('|')

  it('оставляет свежую кучу в покое: сама она не осыпается', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const heap = createFilledHeap(seed)
      const before = getProfile(heap)

      advance(heap, 300)

      expect(getProfile(heap)).toBe(before)
    }
  })

  it('засыпает кратер от снятой крупной игрушки', () => {
    // Кубик 2×2×2 на полу, вокруг него стены из одноклеточных на два слоя выше его верха
    const around: HeapSnapshot['bodies'] = []

    for (let col = 2; col <= 6; col++) {
      for (let row = 2; row <= 6; row++) {
        const inside = col >= 3 && col <= 4 && row >= 3 && row <= 4

        if (inside) continue

        for (let layer = 0; layer < 4; layer++) {
          around.push({ shape: 'single', facing: 0, anchor: { col, row }, layer, color: 1 })
        }
      }
    }

    const heap = createHeap([
      ...around,
      { shape: 'cube8', facing: 0, anchor: { col: 3, row: 3 }, layer: 0, color: 2 },
    ])
    const before = [...heap.getBodies()].length

    // Кубик открыт сверху: в его столбцах над ним ничего нет
    expect(heap.getTopBody({ col: 3, row: 3 })?.shape).toBe('cube8')
    expect(lift(heap, { col: 3, row: 3 })).toBeDefined()

    advance(heap, 600)

    // В освободившиеся 2×2×2 насыпалось с краёв: пол кратера накрыт, а стены вокруг просели
    for (const cell of [
      { col: 3, row: 3 },
      { col: 4, row: 3 },
      { col: 3, row: 4 },
      { col: 4, row: 4 },
    ]) {
      expect(heap.getSurfaceHeight(cell)).toBeGreaterThan(0)
    }

    expect(heap.getSurfaceHeight({ col: 2, row: 3 })).toBeLessThan(4)
    // Игрушка в клешне из кучи не исчезает: она только вышла из решётки
    expect([...heap.getBodies()].length).toBe(before)
    expectSoundHeap(heap)
  })

  it('не оставляет пустых ячеек пола под кучей после длинной серии изъятий', () => {
    const random = createRandom(21)
    const heap = createFilledHeap(21)

    expect(getBareFloor(heap)).toBe(0)

    for (let round = 0; round < 25; round++) {
      lift(heap, { col: Math.floor(random() * GRID_SIZE), row: Math.floor(random() * GRID_SIZE) })
      if (heap.isHolding) heap.dropIntoTray(grip(heap))
      advance(heap, 120)
    }

    advance(heap, 600)

    // Единичные клетки остаться могут: в проём шириной в одну клетку составная форма не влезает
    expect(getBareFloor(heap)).toBeLessThanOrEqual(2)
    expectSoundHeap(heap)
  })
})

describe('HeapStore: инварианты под нагрузкой', () => {
  const pickCell = (random: () => number): CellAddress => ({
    col: Math.floor(random() * GRID_SIZE),
    row: Math.floor(random() * GRID_SIZE),
  })

  it(
    'держит кучу связной после длинной серии изъятий и возвратов',
    () => {
      const random = createRandom(11)
      const heap = createFilledHeap(11)

      for (let round = 0; round < 60; round++) {
        const id = lift(heap, pickCell(random))

        settle(heap, STRESS_FRAME_MS)
        expectSoundHeap(heap)

        if (id !== undefined) {
          heap.release({ ...grip(heap), ...getCellCenter(pickCell(random)) })
          settle(heap, STRESS_FRAME_MS)
          expectSoundHeap(heap)
        }
      }
    },
    15_000
  )

  it('сходится за конечное число кадров даже на обвале всей кучи', () => {
    const heap = createFilledHeap(12)

    // Снимаем верхние игрушки середины поля: под ними обваливается всё, что на них стояло
    for (let col = 2; col < GRID_SIZE - 2; col++) {
      for (let row = 2; row < GRID_SIZE - 2; row++) {
        lift(heap, { col, row })
        if (heap.isHolding) heap.dropIntoTray(grip(heap))
        settle(heap)
      }
    }

    expect(settle(heap)).toBeLessThan(MAX_FRAMES)
    expectSoundHeap(heap)
  })
})

describe('HeapStore: снимок', () => {
  const sortBodies = (snapshot: HeapSnapshot): HeapSnapshot['bodies'] =>
    [...snapshot.bodies].sort((left, right) =>
      `${left.anchor.col}${left.anchor.row}${left.layer}`.localeCompare(
        `${right.anchor.col}${right.anchor.row}${right.layer}`
      )
    )

  it('переживает круг снимок — восстановление — снимок', () => {
    const heap = createFilledHeap(13)
    const snapshot = heap.takeSnapshot(7)
    const restored = new HeapStore()

    restored.restore(snapshot, createRandom(13))

    const again = restored.takeSnapshot(7)

    expect(again.version).toBe(HEAP_SNAPSHOT_VERSION)
    expect(again.collected).toBe(7)
    expect(sortBodies(again)).toEqual(sortBodies(snapshot))
    expectSoundHeap(restored)
  })

  it('запрещает снимок до завершения падения и не начисляет приз при сериализации', () => {
    const heap = createFilledHeap(14)

    lift(heap, { col: 4, row: 4 })
    settle(heap)
    expect(() => heap.takeSnapshot(0)).toThrow('Heap is not settled')
    heap.dropIntoTray(grip(heap))
    expect(() => heap.takeSnapshot(0)).toThrow('Heap is not settled')
    settle(heap)

    expect(heap.takeSnapshot(0).collected).toBe(0)
    expect(heap.releaseOutcome.status).toBe('collected')
  })

  it('ведёт игрушку ниже пола и передаёт её форму с цветом только после выхода', () => {
    const heap = createFilledHeap(15)
    const id = lift(heap, { col: 4, row: 4 }) as number

    settle(heap)
    const source = [...heap.getBodies()].find((body) => body.id === id) as ToyBody
    const appearance = { shape: source.shape, color: source.color }
    const beforeFall = [...heap.getBodies()].find((candidate) => candidate.id === id) as ToyBody
    const expectedDuration = getMotionMs(getWeight(beforeFall.shape), beforeFall.pose.point, {
      ...beforeFall.pose.point,
      z: TRAY_EXIT_Z,
    })
    heap.dropIntoTray(grip(heap))
    const fallMs = expectedDuration

    const falling = [...heap.getBodies()].find((candidate) => candidate.id === id) as ToyBody

    expect(falling.target.z).toBe(TRAY_EXIT_Z)
    expect(fallMs).toBe(expectedDuration)
    expect(falling.durationMs).toBe(expectedDuration)

    heap.advance(fallMs * 0.99)

    expect(falling.pose.point.z).toBeLessThan(0)
    expect([...heap.getBodies()]).toContain(falling)
    expect(heap.releaseOutcome.status).not.toBe('collected')

    heap.advance(fallMs * 0.01)

    expect([...heap.getBodies()]).not.toContain(falling)
    expect(heap.releaseOutcome.status).toBe('collected')
    expect(heap.releaseOutcome).toEqual({ status: 'collected', appearance })
  })

  it('запрещает снимок на всех этапах соскальзывания в лоток', () => {
    const heap = createStackByTray(createTrayHitRandom())
    const id = lift(heap, TRAY_EDGE) as number

    heap.release(grip(heap))

    const body = [...heap.getBodies()].find((candidate) => candidate.id === id) as ToyBody
    expect(() => heap.takeSnapshot(4)).toThrow('Heap is not settled')

    expect(body.state).toBe(ToyState.landingBeforeTray)

    heap.advance(body.durationMs)

    expect(() => heap.takeSnapshot(4)).toThrow('Heap is not settled')

    expect(body.state).toBe(ToyState.waitingForTraySlide)

    heap.advance(TRAY_SLIDE_DELAY_MS)

    expect(() => heap.takeSnapshot(4)).toThrow('Heap is not settled')

    expect(body.state).toBe(ToyState.slidingToTray)

    heap.advance(body.durationMs)

    expect(() => heap.takeSnapshot(4)).toThrow('Heap is not settled')

    expect(body.state).toBe(ToyState.fallingIntoTray)
  })

  it('восстановленная куча стоит в покое и не выше предела слоёв', () => {
    const heap = createFilledHeap(15)
    const restored = new HeapStore()

    restored.restore(heap.takeSnapshot(0), createRandom(1))

    expect(restored.settled).toBe(true)
    expect(settle(restored)).toBe(1)

    for (const cell of getCells(restored)) {
      expect(cell.layer).toBeLessThan(MAX_LAYERS)
    }
  })
})
