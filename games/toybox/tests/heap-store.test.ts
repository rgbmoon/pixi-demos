// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CLAW_GRAB_MS, CLAW_REST_HEIGHT, FIELD_CENTER, GRID_SIZE, TRAY_CENTER } from '#src/constants'
import { Heap } from '#src/heap/heap'
import { type ToyBody, ToyState } from '#src/heap/types'
import { pourHeap } from '#src/heap/utils'
import { SHAPE_KEYS } from '#src/toys'
import type { HeapSnapshotBody, ShapeKey, WorldPoint } from '#src/types'
import { polygonsOverlap } from '#src/utils/geometry'
import { getSection, getVariant, getVariantCount, placeSection, toPlane } from '#src/utils/shapes'
import { createRandom } from '@pixi-demos/core/random'

const FRAME_MS = 1000 / 60
/** Предохранитель: куча, которая не встала за столько кадров, считается зациклившейся. */
const MAX_FRAMES = 10_000
/** Допуск пересечения тел: движок держит касание с проникновением порядка своего допуска. */
const OVERLAP_TOLERANCE = 0.05
/** Точка захвата пустой клешни в покое: её получает кадровый шаг, пока игрушки в клешне нет. */
const REST_GRIP: WorldPoint = { ...FIELD_CENTER, z: CLAW_REST_HEIGHT }

/** Крутит кадры, пока куча не придёт в покой; отвечает, сколько кадров на это ушло. */
const settle = (heap: Heap, deltaMs = FRAME_MS): number => {
  for (let frame = 1; frame <= MAX_FRAMES; frame++) {
    heap.advance(deltaMs, REST_GRIP)

    if (heap.settled) return frame
  }

  throw new Error('Heap never settled')
}

const createFilledHeap = (seed: number): Heap => {
  const heap = new Heap()

  heap.restore(pourHeap(createRandom(seed)))

  return heap
}

/** Куча из снимка: тесты, которым нужна известная раскладка, строят её руками. */
const createHeap = (bodies: HeapSnapshotBody[]): Heap => {
  const heap = new Heap()

  heap.restore(bodies)

  return heap
}

/** Нижняя и верхняя границы сечения относительно центра игрушки. */
const getExtent = (shape: ShapeKey, variant: number): { bottom: number; top: number } => {
  const heights = getSection(shape, variant).map(({ z }) => z)

  return { bottom: Math.min(...heights), top: Math.max(...heights) }
}

/** Игрушка снимка, стоящая без крена на высоте `floor`. */
const stand = (shape: ShapeKey, slab: number, y: number, floor: number, variant = 0): HeapSnapshotBody => ({
  shape,
  variant,
  slab,
  y,
  z: floor - getExtent(shape, variant).bottom + 0.001,
  angle: 0,
  color: 0xff8800,
})

/** Верх игрушки снимка. */
const topOf = ({ shape, variant, z }: HeapSnapshotBody): number => z + getExtent(shape, variant).top

const sectionOf = (body: Readonly<ToyBody>) =>
  toPlane(placeSection(getSection(body.shape, body.variant), { ...body.pose.point, angle: body.pose.angle }))

const shareSlab = (first: Readonly<ToyBody>, second: Readonly<ToyBody>): boolean =>
  first.slab < second.slab + getVariant(second.shape, second.variant).depth &&
  second.slab < first.slab + getVariant(first.shape, first.variant).depth

const findBody = (heap: Heap, id: number | undefined): Readonly<ToyBody> => {
  const body = [...heap.getBodies()].find((candidate) => candidate.id === id)

  if (!body) throw new Error(`No toy ${id}`)

  return body
}

/** Проверяет то, что обязано быть верно про кучу в покое: позы конечны, игрушки в кубе и не пересекаются. */
const expectSoundHeap = (heap: Heap): void => {
  const bodies = [...heap.getBodies()].filter((body) => body.state === ToyState.free)

  for (const body of bodies) {
    const { point, angle } = body.pose

    expect([point.x, point.y, point.z, angle].every(Number.isFinite)).toBe(true)

    for (const { x: y, y: z } of sectionOf(body)) {
      expect(y).toBeGreaterThan(-OVERLAP_TOLERANCE)
      expect(y).toBeLessThan(GRID_SIZE + OVERLAP_TOLERANCE)
      expect(z).toBeGreaterThan(-OVERLAP_TOLERANCE)
    }
  }

  for (let first = 0; first < bodies.length; first++) {
    for (let second = first + 1; second < bodies.length; second++) {
      if (!shareSlab(bodies[first], bodies[second])) continue

      expect(polygonsOverlap(sectionOf(bodies[first]), sectionOf(bodies[second]), OVERLAP_TOLERANCE)).toBe(false)
    }
  }
}

/** Точки совпадают до ошибки округления. */
const expectPoint = (actual: WorldPoint, expected: WorldPoint): void => {
  expect(actual.x).toBeCloseTo(expected.x, 12)
  expect(actual.y).toBeCloseTo(expected.y, 12)
  expect(actual.z).toBeCloseTo(expected.z, 12)
}

/** Поднимает игрушку под точкой на высоту покоя клешни; отвечает её id. */
const liftToRest = (heap: Heap, point: { x: number; y: number }): number | undefined => {
  const grip = { ...point, z: heap.getSurfaceHeightAt(point) }
  const id = heap.getTopBodyAt(point)?.id

  if (!heap.lift(point, grip)) return undefined

  heap.advance(CLAW_GRAB_MS, grip)

  for (let {z} = grip; z < CLAW_REST_HEIGHT; z += 0.25) {
    heap.advance(FRAME_MS, { ...point, z })
  }

  return id
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Heap: наполнение', () => {
  it('насыпает одну и ту же кучу на одном сиде и разные — на разных', () => {
    const first = createFilledHeap(1).takeSnapshot()

    expect(createFilledHeap(1).takeSnapshot()).toEqual(first)
    expect(createFilledHeap(2).takeSnapshot()).not.toEqual(first)
  })

  it('насыпает все формы каталога и не засчитывает призов', () => {
    const shapes = new Set<ShapeKey>()

    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const heap = createFilledHeap(seed)

      for (const body of heap.getBodies()) shapes.add(body.shape)
      expect(heap.prizeCount).toBe(0)
    }

    expect([...shapes].sort()).toEqual([...SHAPE_KEYS].sort())
  })

  it('держит игрушки внутри куба, над полом и без взаимных пересечений', () => {
    for (const seed of [1, 2, 3, 4]) expectSoundHeap(createFilledHeap(seed))
  })

  it('складывает купол: в середине поля игрушки лежат выше, чем у стенок', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const bodies = [...createFilledHeap(seed).getBodies()]
      const average = (picked: Readonly<ToyBody>[]) =>
        picked.reduce((sum, body) => sum + body.pose.point.z, 0) / picked.length
      const isMiddle = ({ pose }: Readonly<ToyBody>) =>
        Math.abs(pose.point.x - GRID_SIZE / 2) < 2 && Math.abs(pose.point.y - GRID_SIZE / 2) < 2
      const isEdge = ({ pose }: Readonly<ToyBody>) =>
        [pose.point.x, pose.point.y].some((value) => value < 1.5 || value > GRID_SIZE - 1.5)

      expect(average(bodies.filter(isMiddle))).toBeGreaterThan(average(bodies.filter(isEdge)))
    }
  })

  it('оставляет наполненную кучу в покое: сама она не движется', () => {
    const heap = createFilledHeap(3)
    const before = heap.takeSnapshot()

    expect(heap.settled).toBe(true)
    for (let frame = 0; frame < 120; frame++) heap.advance(FRAME_MS, REST_GRIP)

    expect(heap.settled).toBe(true)
    expect(heap.takeSnapshot()).toEqual(before)
  })

  it('не выдаёт повторно id игрушек после нового наполнения', () => {
    const heap = createFilledHeap(1)
    const first = new Set([...heap.getBodies()].map(({ id }) => id))

    heap.restore(pourHeap(createRandom(2)))

    expect([...heap.getBodies()].some(({ id }) => first.has(id))).toBe(false)
  })
})

describe('Heap: захват', () => {
  const cube = stand('cube8', 3, 4, 0)
  const pillow = stand('square4', 3, 4, topOf(cube))
  const ball = stand('single', 3, 4, topOf(pillow))

  it('отдаёт клешне верхнюю игрушку под точкой, а не ту, что под ней', () => {
    const heap = createHeap([cube, pillow, ball])

    expect(heap.getTopBodyAt({ x: 3.5, y: 4 })?.shape).toBe('single')
  })

  it('роняет игрушку, лежавшую на поднятой', () => {
    const heap = createHeap([cube, stand('single', 3, 4.5, topOf(cube))])
    const [base, rider] = [...heap.getBodies()]
    const before = rider.pose.point.z
    const point = { x: 3.5, y: 3.3 }
    const grip = { ...point, z: heap.getSurfaceHeightAt(point) }

    expect(heap.getTopBodyAt(point)?.id).toBe(base.id)
    expect(heap.lift(point, grip)).toBe(true)

    for (let frame = 0; frame < 90; frame++) heap.advance(FRAME_MS, grip)

    expect(rider.pose.point.z).toBeLessThan(before - 1)
  })

  it('сохраняет видимую позу при захвате любой формы', () => {
    for (const shape of SHAPE_KEYS) {
      for (let variant = 0; variant < getVariantCount(shape); variant++) {
        const heap = createHeap([stand(shape, 3, 4, 0, variant)])
        const point = { x: 3.5, y: 4 }
        const body = heap.getTopBodyAt(point) as Readonly<ToyBody>
        const visible = { ...body.pose.point }
        const grip = { ...point, z: heap.getSurfaceHeightAt(point) }

        heap.lift(point, grip)
        heap.advance(0, grip)

        expectPoint(body.pose.point, visible)

        heap.advance(0, { x: grip.x + 1, y: grip.y - 1, z: grip.z + 2 })

        expectPoint(body.pose.point, { x: visible.x + 1, y: visible.y - 1, z: visible.z + 2 })
      }
    }
  })
})

describe('Heap: прожатие', () => {
  it('толкает игрушку под клешнёй импульсом: куча выходит из покоя и снова приходит в него целой', () => {
    const heap = createFilledHeap(2)

    heap.press({ x: 4.5, y: 4 })

    expect(heap.settled).toBe(false)
    expect(settle(heap)).toBeLessThan(MAX_FRAMES)
    expectSoundHeap(heap)
  })

  it('не толкает игрушку при уменьшенном движении', () => {
    const heap = createFilledHeap(2)
    const before = heap.takeSnapshot()

    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    heap.press({ x: 4.5, y: 4 })
    heap.advance(FRAME_MS, REST_GRIP)

    expect(heap.settled).toBe(true)
    expect(heap.takeSnapshot()).toEqual(before)
  })
})

describe('Heap: отпускание', () => {
  it('возвращает отпущенную игрушку в кучу и приходит в покой', () => {
    const heap = createFilledHeap(3)
    const count = [...heap.getBodies()].length
    const id = liftToRest(heap, { x: 4.5, y: 4 })

    expect(id).toBeDefined()

    heap.release({ x: 2.5, y: 2.5, z: CLAW_REST_HEIGHT })
    settle(heap)

    expect(heap.isHolding).toBe(false)
    expect(findBody(heap, id).state).toBe(ToyState.free)
    expect([...heap.getBodies()]).toHaveLength(count)
    expectSoundHeap(heap)
  })

  it('поднимает игрушку, отпущенную внутри другой, до свободного места', () => {
    const cubeBody = stand('cube8', 3, 4, 0)
    const heap = createHeap([cubeBody, stand('single', 6, 2, 0)])
    const [cube, ball] = [...heap.getBodies()]
    const point = { x: 6.5, y: 2 }
    const grip = { ...point, z: heap.getSurfaceHeightAt(point) }

    heap.lift(point, grip)
    heap.advance(CLAW_GRAB_MS, grip)
    heap.release({ x: 3.5, y: 4, z: cubeBody.z })

    expect(polygonsOverlap(sectionOf(ball), sectionOf(cube), OVERLAP_TOLERANCE)).toBe(false)

    settle(heap)
    expectSoundHeap(heap)
  })
})

describe('Heap: лоток', () => {
  it('засчитывает доставленную игрушку призом один раз и убирает её из кучи', () => {
    const heap = createHeap([stand('cube8', 4, 3, 0), stand('single', 5, 6, 0)])
    const id = liftToRest(heap, { x: 5.5, y: 6 })
    const { shape, color } = findBody(heap, id)

    heap.dropIntoTray({ ...TRAY_CENTER, z: CLAW_REST_HEIGHT })
    settle(heap)

    expect(heap.prizeCount).toBe(1)
    expect(heap.takePrize()).toEqual({ shape, color })
    expect(heap.prizeCount).toBe(0)
    expect([...heap.getBodies()].map((body) => body.shape)).toEqual(['cube8'])
  })

  it('засчитывает игрушку, упавшую в шахту лотка без помощи клешни', () => {
    const heap = createHeap([stand('single', 5, 4, 0)])

    liftToRest(heap, { x: 5.5, y: 4 })
    heap.release({ ...TRAY_CENTER, z: 4 })
    settle(heap)

    expect(heap.prizeCount).toBe(1)
    expect([...heap.getBodies()]).toHaveLength(0)
  })
})

describe('Heap: снимок', () => {
  it('переживает круг снимок — восстановление — снимок, в том числе после цикла', () => {
    const heap = createFilledHeap(4)

    liftToRest(heap, { x: 4.5, y: 4 })
    heap.release({ x: 5.5, y: 5.5, z: CLAW_REST_HEIGHT })
    settle(heap)

    for (const snapshot of [createFilledHeap(5).takeSnapshot(), heap.takeSnapshot()]) {
      const restored = new Heap()

      restored.restore(snapshot)

      expect(restored.takeSnapshot()).toEqual(snapshot)
    }
  })

  it('не сдвигает восстановленную кучу, пока её не тронули', () => {
    const snapshot = createFilledHeap(6).takeSnapshot()
    const heap = new Heap()

    heap.restore(snapshot)
    for (let frame = 0; frame < 120; frame++) heap.advance(FRAME_MS, REST_GRIP)

    expect(heap.settled).toBe(true)
    expect(heap.takeSnapshot()).toEqual(snapshot)
  })

  it('запрещает снимок с игрушкой в клешне и до покоя после отпускания', () => {
    const heap = createFilledHeap(2)

    liftToRest(heap, { x: 4.5, y: 4 })

    expect(() => heap.takeSnapshot()).toThrow('Heap is not settled')

    heap.release({ x: 2.5, y: 4, z: CLAW_REST_HEIGHT })

    expect(() => heap.takeSnapshot()).toThrow('Heap is not settled')

    settle(heap)

    expect(() => heap.takeSnapshot()).not.toThrow()
  })
})

describe('Heap: нагрузка', () => {
  it('приходит в покой после серии случайных циклов и сохраняет кучу целой', () => {
    const heap = createFilledHeap(11)
    const random = createRandom(99)

    for (let round = 0; round < 10; round++) {
      const point = { x: 1 + random() * (GRID_SIZE - 2), y: 1 + random() * (GRID_SIZE - 2) }

      if (liftToRest(heap, point) === undefined) continue

      const toTray = random() < 0.3
      const target = toTray
        ? { ...TRAY_CENTER, z: CLAW_REST_HEIGHT }
        : { x: 1 + random() * (GRID_SIZE - 2), y: 1 + random() * (GRID_SIZE - 2), z: CLAW_REST_HEIGHT }

      if (toTray) heap.dropIntoTray(target)
      else heap.release(target)

      expect(settle(heap)).toBeLessThan(MAX_FRAMES)
      expectSoundHeap(heap)
    }
  })
})

describe('Heap: уменьшенное движение', () => {
  it('приходит в покой за один кадр', () => {
    const heap = createFilledHeap(5)

    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    liftToRest(heap, { x: 4.5, y: 4 })
    heap.release({ x: 2.5, y: 5, z: CLAW_REST_HEIGHT })
    heap.advance(FRAME_MS, REST_GRIP)

    expect(heap.settled).toBe(true)
  })
})
