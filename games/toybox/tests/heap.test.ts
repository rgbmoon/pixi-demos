import { afterEach, describe, expect, it, vi } from 'vitest'

import { CLAW_REST_HEIGHT } from '#src/claw/constants'
import {
  ART_CELL,
  ART_PIXEL,
  CART_SIZE,
  CLAW_ART_WIDTH,
  CLAW_GRAB_MS,
  CLAW_GRAB_ROLL_MS,
  CLAW_GRIP_DEPTH,
  GRID_SIZE,
  MARQUEE_LAMP_COUNT,
  PILLAR_WIDTH,
  TRAY_CENTER,
} from '#src/constants'
import type { Heap } from '#src/heap/heap'
import { type ToyBody, ToyState } from '#src/heap/types'
import { lerpPose, pourHeap } from '#src/heap/utils'
import { TOY_KEYS } from '#src/toys'
import type { GroundPoint, HeapSnapshotBody, PlaneVector, ToyKey } from '#src/types'
import { polygonsOverlap } from '#src/utils/geometry'
import { clampToField } from '#src/utils/machine-geometry'
import { worldToScreen } from '#src/utils/projection'
import { getDepth, getDepthCenter, getPrismOutline, getSection, getSectionExtent } from '#src/utils/shapes'
import { createRandom } from '@pixi-demos/core/random'

import {
  createHeap,
  expectSoundHeap,
  findBody,
  FRAME_MS,
  getPouredHeap,
  liftToRest,
  REST_GRIP,
  sectionOf,
  settle,
  stand,
  topOf,
} from './setup/heap'

/** Насколько кончики пальцев клешни ниже точки захвата, px арта: по кадрам `art/claw/`. */
const CLAW_FINGER_REACH = 25

/** Сиды насыпанных куч, на которых проверяются свойства наполнения. */
const SAMPLE_SEEDS = [1, 2, 3]

/** Все положения всех форм каталога. */
/** Лежит ли точка внутри выпуклого многоугольника или на его границе. */
const isInside = (polygon: readonly PlaneVector[], point: PlaneVector): boolean => {
  const sides = polygon.map((corner, index) => {
    const next = polygon[(index + 1) % polygon.length]

    return (next.x - corner.x) * (point.y - corner.y) - (next.y - corner.y) * (point.x - corner.x)
  })

  return sides.every((side) => side >= -1e-9) || sides.every((side) => side <= 1e-9)
}

/** Точка поля над центром игрушки снимка. */
const above = ({ slab, y }: HeapSnapshotBody): GroundPoint => ({ x: slab + 0.5, y })

/** Наклоняет игрушку снимка на угол `angle`. */
const tilted = (body: HeapSnapshotBody, angle: number): HeapSnapshotBody => ({ ...body, angle })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('куча: наполнение', () => {
  it('насыпает одну и ту же кучу на одном сиде и разные — на разных', () => {
    expect(pourHeap(createRandom(2))).toEqual(getPouredHeap(2))
    expect(getPouredHeap(3)).not.toEqual(getPouredHeap(2))
  })

  it('насыпает игрушки без повторов, пока каталог не исчерпан', () => {
    for (const seed of SAMPLE_SEEDS) {
      const toys = getPouredHeap(seed).map(({ toy }) => toy)

      expect(toys.length).toBeLessThanOrEqual(TOY_KEYS.length)
      expect(new Set(toys).size).toBe(toys.length)
    }
  })

  it('отмечает лампой табло столько игрушек, сколько ламп на табло', () => {
    for (const seed of SAMPLE_SEEDS) {
      expect(getPouredHeap(seed).filter(({ hasLamp }) => hasLamp)).toHaveLength(MARQUEE_LAMP_COUNT)
    }
  })

  it('держит игрушки внутри куба, над полом и без взаимных пересечений', () => {
    for (const seed of SAMPLE_SEEDS) expectSoundHeap(createHeap(getPouredHeap(seed)))
  })

  it('не заходит на экране на заднюю правую стойку куба вместе с обводкой подсветки', () => {
    const limit = worldToScreen({ x: GRID_SIZE, y: PILLAR_WIDTH / ART_CELL, z: 0 }).x - ART_PIXEL

    for (const seed of SAMPLE_SEEDS) {
      for (const { toy, slab, y, z, angle } of getPouredHeap(seed)) {
        const depth = getDepth(toy)
        const center = worldToScreen({ x: getDepthCenter(slab, depth), y, z })
        const right = Math.max(...getPrismOutline(getSection(toy), depth, angle).map(({ x }) => x + center.x))

        expect(right, `${toy} в срезе ${slab}, сид ${seed}`).toBeLessThanOrEqual(limit)
      }
    }
  })

  it('не заходит на экране на клешню в покое над серединой поля', () => {
    const grip = worldToScreen(REST_GRIP)
    const half = (CLAW_ART_WIDTH / 2) * ART_PIXEL
    const top = grip.y - CLAW_GRIP_DEPTH * ART_PIXEL
    const bottom = grip.y + CLAW_FINGER_REACH * ART_PIXEL
    const claw = [
      { x: grip.x - half, y: top },
      { x: grip.x + half, y: top },
      { x: grip.x + half, y: bottom },
      { x: grip.x - half, y: bottom },
    ]

    for (const seed of SAMPLE_SEEDS) {
      for (const { toy, slab, y, z, angle } of getPouredHeap(seed)) {
        const depth = getDepth(toy)
        const center = worldToScreen({ x: getDepthCenter(slab, depth), y, z })
        const outline = getPrismOutline(getSection(toy), depth, angle).map((point) => ({
          x: point.x + center.x,
          y: point.y + center.y,
        }))

        expect(polygonsOverlap(outline, claw, 0), `${toy} в срезе ${slab}, сид ${seed}`).toBe(false)
      }
    }
  })

  it('складывает купол: в середине поля верх кучи выше, чем у стенок', () => {
    const average = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
    // Узлы сетки с шагом в полклетки: средняя область поля и полоса у стенок
    const nodes = Array.from({ length: 2 * GRID_SIZE }, (_, index) => (index + 0.5) / 2)
    const points = nodes.flatMap((x) => nodes.map((y) => ({ x, y })))
    const middle = points.filter(({ x, y }) => [x, y].every((value) => Math.abs(value - GRID_SIZE / 2) < 2))
    const edge = points.filter(({ x, y }) => [x, y].some((value) => value < 1.5 || value > GRID_SIZE - 1.5))

    for (const seed of SAMPLE_SEEDS) {
      const heap = createHeap(getPouredHeap(seed))
      const heights = (area: readonly GroundPoint[]) => average(area.map((point) => heap.getSurfaceHeightAt(point)))

      expect(heights(middle)).toBeGreaterThan(heights(edge))
    }
  })

  it('восстанавливает кучу спящей: без возмущения она не сдвигается', () => {
    const snapshot = getPouredHeap(1)
    const heap = createHeap(snapshot)

    for (let frame = 0; frame < 120; frame++) heap.advance(FRAME_MS, REST_GRIP)

    expect(heap.settled).toBe(true)
    expect(heap.takeSnapshot()).toEqual(snapshot)
  })
})

describe('куча: каталог форм', () => {
  it('даёт выпуклое сечение не длиннее предела вершин многоугольника planck', () => {
    // planck молча обрезает многоугольник до 12 вершин, а сортировка наложения полагается на выпуклость
    for (const toy of TOY_KEYS) {
      const polygon = getSection(toy).map(({ y, z }) => ({ x: y, y: z }))

      expect(polygon.length).toBeGreaterThanOrEqual(3)
      expect(polygon.length).toBeLessThanOrEqual(12)
      for (const point of polygon) expect(isInside(polygon, point)).toBe(true)
    }
  })
})

describe('куча: захват', () => {
  const cube = stand('teddy', 3, 4, 0)
  const pillow = stand('lying-pig', 3, 4, topOf(cube))
  const ball = stand('dolphin', 3, 4, topOf(pillow))

  it('отдаёт клешне верхнюю игрушку под точкой, а не ту, что под ней', () => {
    const heap = createHeap([cube, pillow, ball])

    expect(heap.getTopBodyAt({ x: 3.5, y: 4 })?.toy).toBe('dolphin')
  })

  it('находит игрушку любой формы в углу куба из крайнего положения каретки', () => {
    // Угол над лотком занят шахтой: игрушка там не лежит
    const corners = [
      { front: true, left: false },
      { front: false, left: false },
      { front: false, left: true },
    ]

    for (const toy of TOY_KEYS) {
      const depth = getDepth(toy)
      const { halfWidth } = getSectionExtent(getSection(toy))

      for (const { front, left } of corners) {
        const body = stand(toy, front ? 0 : GRID_SIZE - depth, left ? GRID_SIZE - halfWidth : halfWidth, 0)
        const heap = createHeap([body])
        const cart = clampToField({ x: front ? 0 : GRID_SIZE, y: left ? GRID_SIZE : 0 }, CART_SIZE / 2)

        expect(heap.getTopBodyAt(cart), `${toy} front=${front} left=${left}`).toBeDefined()
      }
    }
  })

  it('роняет игрушку, лежавшую на поднятой', () => {
    const heap = createHeap([cube, stand('dolphin', 3, 5, topOf(cube))])
    const rider = [...heap.getBodies()][1]
    const before = rider.pose.point.z
    const point = { x: 3.5, y: 3.2 }
    const grip = { ...point, z: heap.getSurfaceHeightAt(point) }

    expect(heap.lift(point, grip)).toBe(true)

    for (let frame = 0; frame < 90; frame++) heap.advance(FRAME_MS, grip)

    expect(rider.pose.point.z).toBeLessThan(before - 1)
  })

  it('не дёргает игрушку при захвате, к смыканию клешни выравнивает крен, к концу захвата ставит её под клешню', () => {
    let lowered = 0

    for (const toy of TOY_KEYS) {
      const heap = createHeap([tilted(stand(toy, 3, 4, 0), 0.3)])
      const point = { x: 3.5, y: 4.2 }
      const body = heap.getTopBodyAt(point) as Readonly<ToyBody>
      const visible = { ...body.pose.point }
      const grip = { ...point, z: heap.getSurfaceHeightAt(point) }
      const top = Math.max(...getSection(toy).map(({ z }) => z))
      const seatedZ = Math.min(visible.z, grip.z - top)

      if (seatedZ < visible.z - 1e-6) lowered += 1
      heap.lift(point, grip)
      heap.advance(0, grip)

      expect(body.pose.point.x).toBeCloseTo(visible.x, 12)
      expect(body.pose.point.y).toBeCloseTo(visible.y, 12)
      expect(body.pose.point.z).toBeCloseTo(visible.z, 12)
      expect(body.pose.angle).toBe(0.3)

      heap.advance(CLAW_GRAB_ROLL_MS, grip)

      expect(body.pose.angle).toBeCloseTo(0, 9)

      for (let elapsed = CLAW_GRAB_ROLL_MS; elapsed <= CLAW_GRAB_MS; elapsed += FRAME_MS) heap.advance(FRAME_MS, grip)

      expect(body.pose.point.x).toBeCloseTo(grip.x, 9)
      expect(body.pose.point.y).toBeCloseTo(grip.y, 9)
      expect(body.pose.point.z).toBeCloseTo(seatedZ, 9)
      expect(body.pose.angle).toBeCloseTo(0, 9)
    }

    expect(lowered).toBeGreaterThan(0)
  })

  it('при уменьшенном движении ставит игрушку под клешню за один кадр', () => {
    const heap = createHeap([tilted(stand('giraffe', 3, 4, 0), 0.3)])
    const point = { x: 3.5, y: 4.2 }
    const body = heap.getTopBodyAt(point) as Readonly<ToyBody>
    const grip = { ...point, z: heap.getSurfaceHeightAt(point) }

    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    heap.lift(point, grip)
    heap.advance(FRAME_MS, grip)

    expect(body.pose.point.y).toBeCloseTo(grip.y, 12)
    expect(body.pose.angle).toBeCloseTo(0, 12)
  })

  it('снижает шанс захвата у тяжёлой игрушки и у игрушки под грузом, но не у игрушки с соседом сбоку', () => {
    const halfWidth = (toy: ToyKey) => getSectionExtent(getSection(toy)).halfWidth
    const alone = stand('lying-pig', 1, 1.5, 0)
    const loaded = stand('lying-pig', 5, 1.5, 0)
    const buried = stand('lying-pig', 1, 5, 0)
    const flanked = stand('lying-pig', 5, 5, 0)
    const light = stand('dolphin', 3, 3.5, 0)
    const heavy = stand('teddy', 3, 6.5, 0)
    // Груз сдвинут на срез ближе: он делит с нижней игрушкой только её ближний срез
    const buriedRider = stand('dolphin', 0, 5, topOf(buried))
    // Нагрузка до первого шага физики: движок не знает контактов между телами, которые уснули при восстановлении
    const heap = createHeap([
      alone,
      loaded,
      stand('dolphin', 4, 1.5, topOf(loaded)),
      buried,
      buriedRider,
      stand('dolphin', 0, 5, topOf(buriedRider)),
      flanked,
      stand('dolphin', 5, 5 + halfWidth('lying-pig') + halfWidth('dolphin') + 0.01, 0),
      light,
      heavy,
    ])
    // Груз лежит в ближнем срезе: шанс нижней игрушки берётся над её дальним срезом, где груза нет
    const chanceOf = (body: HeapSnapshotBody) => heap.getGrabChance({ x: body.slab + 1.5, y: body.y })

    expect(heap.getGrabChance(above(light))).toBeGreaterThan(chanceOf(alone))
    expect(chanceOf(alone)).toBeGreaterThan(heap.getGrabChance(above(heavy)))
    expect(chanceOf(alone)).toBeGreaterThan(chanceOf(loaded))
    expect(chanceOf(loaded)).toBeGreaterThan(chanceOf(buried))
    expect(chanceOf(flanked)).toBe(chanceOf(alone))
    expect(heap.getGrabChance({ x: 3.5, y: 0.5 })).toBe(0)
  })
})

describe('куча: прожатие', () => {
  const cube = stand('teddy', 3, 4, 0)
  const ball = stand('dolphin', 3, 4, topOf(cube))

  it('толкает игрушку под клешнёй: куча выходит из покоя и снова приходит в него целой', () => {
    const heap = createHeap([cube, ball])

    heap.press(above(ball))

    expect(heap.settled).toBe(false)

    settle(heap)
    expectSoundHeap(heap)
  })

  it('не толкает игрушку при уменьшенном движении', () => {
    const heap = createHeap([cube, ball])

    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    heap.press(above(ball))
    heap.advance(FRAME_MS, REST_GRIP)

    expect(heap.settled).toBe(true)
    expect(heap.takeSnapshot()).toEqual([cube, ball])
  })
})

describe('куча: отпускание', () => {
  it('переносит игрушку в срезы под клешнёй и не выпускает её за куб', () => {
    const ball = stand('dolphin', 3, 2, 0)
    const cube = stand('teddy', 3, 5.5, 0)
    const heap = createHeap([ball, cube])
    const ballId = liftToRest(heap, above(ball))

    heap.release({ x: 6.4, y: 2, z: CLAW_REST_HEIGHT })

    const cubeId = liftToRest(heap, above(cube))

    // Куб занимает два среза: у дальней стенки он встаёт в два последних
    heap.release({ x: GRID_SIZE - 0.1, y: 5.5, z: CLAW_REST_HEIGHT })
    settle(heap)

    expect(findBody(heap, ballId)).toMatchObject({ slab: 5, state: ToyState.free, pose: { point: { x: 6 } } })
    expect(findBody(heap, cubeId)).toMatchObject({ slab: 6, state: ToyState.free, pose: { point: { x: 7 } } })
    expect(heap.isHolding).toBe(false)
    expectSoundHeap(heap)
  })

  it('поднимает игрушку, отпущенную внутри другой, до свободного места', () => {
    const cubeBody = stand('teddy', 3, 4, 0)
    const heap = createHeap([cubeBody, stand('dolphin', 6, 2, 0)])
    const [cube, ball] = [...heap.getBodies()]
    const point = { x: 6.5, y: 2 }
    const grip = { ...point, z: heap.getSurfaceHeightAt(point) }

    heap.lift(point, grip)
    heap.advance(CLAW_GRAB_MS, grip)
    heap.release({ x: 3.5, y: 4, z: cubeBody.z })

    expect(polygonsOverlap(sectionOf(ball), sectionOf(cube), 0.05)).toBe(false)

    settle(heap)
    expectSoundHeap(heap)
  })
})

describe('куча: лоток', () => {
  it('засчитывает доставленную игрушку призом один раз и убирает её из кучи', () => {
    const heap = createHeap([stand('teddy', 4, 3, 0), stand('dolphin', 5, 6, 0)])
    const id = liftToRest(heap, { x: 5.5, y: 6 })
    const { toy } = findBody(heap, id)

    heap.dropIntoTray({ ...TRAY_CENTER, z: CLAW_REST_HEIGHT })
    settle(heap)

    expect(heap.prizeCount).toBe(1)
    expect(heap.takePrize()).toEqual({ toy })
    expect(heap.prizeCount).toBe(0)
    expect([...heap.getBodies()].map((body) => body.toy)).toEqual(['teddy'])
  })

  it('засчитывает игрушку, упавшую в шахту лотка без помощи клешни', () => {
    const heap = createHeap([stand('dolphin', 5, 4, 0)])

    liftToRest(heap, { x: 5.5, y: 4 })
    heap.release({ ...TRAY_CENTER, z: 4 })
    settle(heap)

    expect(heap.prizeCount).toBe(1)
    expect([...heap.getBodies()]).toHaveLength(0)
  })
})

describe('куча: снимок', () => {
  /** Цикл клешни над кучей: игрушку из середины переносят в другое место и ждут покоя. */
  const shuffle = (heap: Heap): HeapSnapshotBody[] => {
    expect(liftToRest(heap, { x: 3.5, y: 4 })).toBeDefined()
    heap.release({ x: 5.5, y: 3, z: CLAW_REST_HEIGHT })
    settle(heap)

    return heap.takeSnapshot()
  }

  it('переживает круг снимок — восстановление — снимок после движения кучи', () => {
    const snapshot = shuffle(createHeap(getPouredHeap(1)))

    expect(createHeap(snapshot).takeSnapshot()).toEqual(snapshot)
  })

  it('повторяет физику кучи, заново восстановленной из того же снимка', () => {
    const snapshot = getPouredHeap(3)
    const heap = createHeap(snapshot)
    const first = shuffle(heap)

    heap.restore(snapshot)

    expect(shuffle(heap)).toEqual(first)
  })

  it('не снимает кучу, пока игрушка в клешне или падает после отпускания', () => {
    const heap = createHeap([stand('teddy', 3, 4, 0), stand('dolphin', 6, 2, 0)])

    liftToRest(heap, { x: 6.5, y: 2 })

    expect(() => heap.takeSnapshot()).toThrow('Heap is not settled')

    heap.release({ x: 3.5, y: 4, z: CLAW_REST_HEIGHT })

    expect(() => heap.takeSnapshot()).toThrow('Heap is not settled')

    settle(heap)

    expect(() => heap.takeSnapshot()).not.toThrow()
  })

  it('не выдаёт повторно id игрушек после нового восстановления', () => {
    const heap = createHeap([stand('dolphin', 1, 1, 0), stand('giraffe', 4, 4, 0)])
    const first = new Set([...heap.getBodies()].map(({ id }) => id))

    heap.restore([stand('teddy', 3, 3, 0), stand('grey-bunny', 6, 6, 0)])

    expect([...heap.getBodies()].some(({ id }) => first.has(id))).toBe(false)
  })
})

describe('куча: видимая поза', () => {
  it('сдвигает падающую игрушку на каждом кадре 120 Гц, а не через кадр', () => {
    const heap = createHeap([stand('dolphin', 3, 4, 0)])
    const id = liftToRest(heap, { x: 3.5, y: 4 })
    const heights: number[] = []

    heap.release({ x: 3.5, y: 4, z: CLAW_REST_HEIGHT })

    for (let frame = 0; frame < 20; frame++) {
      heap.advance(1000 / 120, REST_GRIP)
      heights.push(findBody(heap, id).pose.point.z)
    }

    // Видимая поза идёт между двумя последними шагами физики, поэтому первые два кадра показывают позу отпускания
    for (let frame = 2; frame < heights.length; frame++) expect(heights[frame]).toBeLessThan(heights[frame - 1])
  })

  it('ведёт крен между шагами по кратчайшей дуге, в том числе через ±π', () => {
    const from = { y: 1, z: 2, angle: Math.PI - 0.1 }
    const to = { y: 3, z: 4, angle: -Math.PI + 0.1 }
    const middle = lerpPose(from, to, 0.5)

    expect(middle).toMatchObject({ y: 2, z: 3 })
    expect(Math.cos(middle.angle)).toBeCloseTo(-1, 12)
    expect(Math.cos(lerpPose(from, to, 1).angle - to.angle)).toBeCloseTo(1, 12)
  })
})

describe('куча: уменьшенное движение', () => {
  it('приходит в покой за один кадр после отпускания', () => {
    const heap = createHeap([stand('teddy', 3, 4, 0), stand('dolphin', 6, 2, 0)])

    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    liftToRest(heap, { x: 6.5, y: 2 })
    heap.release({ x: 3.5, y: 4, z: CLAW_REST_HEIGHT })
    heap.advance(FRAME_MS, REST_GRIP)

    expect(heap.settled).toBe(true)
  })
})
