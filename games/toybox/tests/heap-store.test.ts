// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

import {
  GRID_SIZE,
  HEAP_SNAPSHOT_VERSION,
  MAX_LAYERS,
  TRAY_CENTER,
  TRAY_FALL_MS,
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
import { getBottomCells, getPlacementCells, getWeight, isBoxCell } from '#src/utils/heap'
import { isTrayCell } from '#src/utils/projection'
import { createRandom } from '@pixi-demos/core/random'
import type { Random } from '@pixi-demos/core/types'

const OUT_OF_GRID = new Set<ToyState>([ToyState.carried, ToyState.slidingToTray, ToyState.fallingIntoTray])
const NOOP = (): void => undefined

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
    .flatMap((body) => getPlacementCells(body.shape, body.facing, body.anchor, body.layer))

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
  const cells = getPlacementCells(body.shape, body.facing, body.anchor, body.layer)

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
      const barAxes = new Set(bodies.filter((body) => body.shape === 'bar2').map((body) => body.facing % 2))

      expect(shapes.size).toBeGreaterThanOrEqual(3)
      expect(barAxes).toEqual(new Set([0, 1]))

      layouts.add(
        bodies
          .map((body) => `${body.shape}:${body.facing % 2}:${body.anchor.col},${body.anchor.row},${body.layer}`)
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
    expect(heap.lift({ col: 3, row: 2 })).toBeDefined()

    settle(heap)

    // После удаления опоры обе верхние игрушки опускаются на пол
    expect([...heap.getBodies()].every((body) => body.layer === 0)).toBe(true)
    expectSoundHeap(heap)
  })
})

describe('HeapStore: цикл клешни', () => {
  it('возвращает поднятую игрушку в кучу и оставляет её связной', () => {
    const heap = createFilledHeap(6)
    const before = [...heap.getBodies()].length
    const id = heap.lift({ col: 4, row: 4 })

    expect(id).toBeDefined()
    settle(heap)

    heap.release(id as number, { col: 6, row: 2 }, NOOP)
    settle(heap)

    expect([...heap.getBodies()].length).toBe(before)
    expectSoundHeap(heap)
  })

  it('засчитывает игрушку, отпущенную над лотком, и убирает её из кучи', () => {
    const heap = createFilledHeap(7)
    const before = [...heap.getBodies()].length
    const id = heap.lift({ col: 4, row: 4 }) as number

    settle(heap)

    const onCollected = vi.fn()

    heap.release(id, { col: 0, row: GRID_SIZE - 1 }, onCollected)
    expect(onCollected).not.toHaveBeenCalled()
    settle(heap)

    expect([...heap.getBodies()].length).toBe(before - 1)
    expect(onCollected).toHaveBeenCalledOnce()
    expectSoundHeap(heap)
  })

  it('не телепортирует игрушку, отпущенную вровень со своим местом или ниже него', () => {
    const heap = createHeap(
      [0, 1, 2].map((layer) => ({ shape: 'single' as const, facing: 0 as const, anchor: { col: 4, row: 4 }, layer, color: 1 }))
    )
    const id = heap.lift({ col: 4, row: 4 }) as number

    settle(heap)

    // Клешня сорвалась у самого верха стопки и стоит ниже места, куда игрушка сядет
    heap.setCarryPoint({ x: 4.5, y: 4.5, z: 1.8 })
    heap.release(id, { col: 4, row: 4 }, NOOP)

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
      const id = heap.lift(TRAY_EDGE) as number
      const onCollected = vi.fn()

      expect(heap.getSurfaceHeight(TRAY_EDGE)).toBeGreaterThanOrEqual(TRAY_WALL_LAYERS)
      heap.release(id, TRAY_EDGE, onCollected)

      expect(onCollected).not.toHaveBeenCalled()
      settle(heap)

      expect([...heap.getBodies()]).toHaveLength(2)
      expect(onCollected).toHaveBeenCalledOnce()
    })

    it('после посадки ждёт 300 мс, движется к центру и падает вертикально', () => {
      const heap = createStackByTray(createTrayHitRandom())
      const id = heap.lift(TRAY_EDGE) as number
      const onCollected = vi.fn()

      heap.setCarryPoint({ x: TRAY_EDGE.col + 0.5, y: TRAY_EDGE.row + 0.5, z: 3 })
      heap.release(id, TRAY_EDGE, onCollected)

      const body = [...heap.getBodies()].find((candidate) => candidate.id === id) as ToyBody

      expect(body.state).toBe(ToyState.landingBeforeTray)
      heap.advance(body.durationMs)
      expect(body.state).toBe(ToyState.waitingForTraySlide)

      const landed = { ...body.point }

      heap.advance(TRAY_SLIDE_DELAY_MS - 1)
      expect(body.state).toBe(ToyState.waitingForTraySlide)
      expect(body.point).toEqual(landed)
      expect(onCollected).not.toHaveBeenCalled()

      heap.advance(1)
      expect(body.state).toBe(ToyState.slidingToTray)
      expect(body.target).toEqual({ ...TRAY_CENTER, z: landed.z })

      heap.advance(body.durationMs)
      expect(body.state).toBe(ToyState.fallingIntoTray)
      expect(body.point.x).toBe(TRAY_CENTER.x)
      expect(body.point.y).toBe(TRAY_CENTER.y)
      expect(body.target).toEqual({ ...TRAY_CENTER, z: 0 })

      heap.advance(TRAY_FALL_MS - 1)
      expect(onCollected).not.toHaveBeenCalled()

      heap.advance(1)
      expect([...heap.getBodies()].find((candidate) => candidate.id === id)).toBeUndefined()
      expect(onCollected).toHaveBeenCalledOnce()
    })

    it('сохраняет задержку 300 мс при уменьшенном движении', () => {
      const matchMedia = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
      const heap = createStackByTray(createTrayHitRandom())
      const id = heap.lift(TRAY_EDGE) as number
      const onCollected = vi.fn()

      heap.release(id, TRAY_EDGE, onCollected)

      const body = [...heap.getBodies()].find((candidate) => candidate.id === id)

      expect(body?.state).toBe(ToyState.waitingForTraySlide)
      heap.advance(TRAY_SLIDE_DELAY_MS - 1)
      expect(body?.state).toBe(ToyState.waitingForTraySlide)
      expect(onCollected).not.toHaveBeenCalled()

      heap.advance(1)
      expect([...heap.getBodies()].find((candidate) => candidate.id === id)).toBeUndefined()
      expect(onCollected).toHaveBeenCalledOnce()

      matchMedia.mockRestore()
    })

    it('оставляет игрушку в кубе, когда бросок перевала не прошёл', () => {
      const heap = createStackByTray(() => 0.99)
      const id = heap.lift(TRAY_EDGE) as number
      const onCollected = vi.fn()

      heap.release(id, TRAY_EDGE, onCollected)

      settle(heap)

      expect([...heap.getBodies()]).toHaveLength(3)
      expect(onCollected).not.toHaveBeenCalled()
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

      const id = heap.lift(TRAY_EDGE) as number

      expect(heap.getSurfaceHeight(TRAY_EDGE)).toBeLessThan(TRAY_WALL_LAYERS)
      heap.release(id, TRAY_EDGE, NOOP)

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
      const id = heap.lift(TRAY_EDGE) as number

      heap.release(id, TRAY_EDGE, NOOP)

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
      const id = heap.lift(anchor) as number

      heap.release(id, anchor, NOOP)

      expect([...heap.getBodies()].find((body) => body.id === id)?.state).toBe(ToyState.falling)
    })
  })

  it('доворачивает игрушку при возврате в кучу', () => {
    const heap = createHeap([{ shape: 'bar2', facing: 0, anchor: { col: 2, row: 2 }, layer: 0, color: 1 }])
    const id = heap.lift({ col: 2, row: 2 }) as number

    heap.release(id, { col: 5, row: 5 }, NOOP)
    settle(heap)

    expect([...heap.getBodies()][0].facing).toBe(1)
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
    expect(heap.lift({ col: 3, row: 3 })).toBeDefined()

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
      heap.lift({ col: Math.floor(random() * GRID_SIZE), row: Math.floor(random() * GRID_SIZE) })
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
        const id = heap.lift(pickCell(random))

        settle(heap, STRESS_FRAME_MS)
        expectSoundHeap(heap)

        if (id !== undefined) {
          heap.release(id, pickCell(random), NOOP)
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
        heap.lift({ col, row })
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

  it('не кладёт в снимок игрушку, которая уходит в лоток', () => {
    const heap = createFilledHeap(14)
    const id = heap.lift({ col: 4, row: 4 }) as number

    settle(heap)
    heap.dropIntoTray(id)

    const snapshot = heap.takeSnapshot(0)

    expect(snapshot.bodies).toHaveLength([...heap.getBodies()].length - 1)
    expect(snapshot.collected).toBe(1)
  })

  it('сохраняет посадку у стенки и считает только начавшееся движение в лоток', () => {
    const heap = createStackByTray(createTrayHitRandom())
    const id = heap.lift(TRAY_EDGE) as number

    heap.release(id, TRAY_EDGE, NOOP)

    const body = [...heap.getBodies()].find((candidate) => candidate.id === id) as ToyBody
    const landing = heap.takeSnapshot(4)

    expect(body.state).toBe(ToyState.landingBeforeTray)
    expect(landing.bodies).toHaveLength(3)
    expect(landing.collected).toBe(4)

    heap.advance(body.durationMs)

    const waiting = heap.takeSnapshot(4)

    expect(body.state).toBe(ToyState.waitingForTraySlide)
    expect(waiting.bodies).toHaveLength(3)
    expect(waiting.collected).toBe(4)

    heap.advance(TRAY_SLIDE_DELAY_MS)

    const committed = heap.takeSnapshot(4)

    expect(body.state).toBe(ToyState.slidingToTray)
    expect(committed.bodies).toHaveLength(2)
    expect(committed.collected).toBe(5)

    heap.advance(body.durationMs)

    const falling = heap.takeSnapshot(4)

    expect(body.state).toBe(ToyState.fallingIntoTray)
    expect(falling.bodies).toHaveLength(2)
    expect(falling.collected).toBe(5)
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
