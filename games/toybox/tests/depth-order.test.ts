// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { CUBE_HEIGHT, GRID_SIZE } from '#src/constants'
import { HeapStore } from '#src/stores/heap'
import type { DepthItem, PlaneVector, ScreenPoint, ShapeKey, WorldPoint } from '#src/types'
import { getDepthRelation, getPlaneDepthItem, getPointDepthItem, getToyDepthItem, orderByDepth } from '#src/utils/depth'
import { getFaceOutline, getTrayWallOutlines } from '#src/utils/machine-geometry'
import { getViewRay, screenToGround } from '#src/utils/projection'
import { getDepthCenter, getVariant } from '#src/utils/shapes'
import { createRandom } from '@pixi-demos/core/random'

const RAY = getViewRay()

/** Расстояние вдоль луча, меньше которого входы в две призмы не различаются. */
const RAY_TOLERANCE = 1e-6
/**
 * Наибольшая площадь пересечения силуэтов, на которой порядок может нарушить отношение пары, в единицах
 * сцены: цикл пересечений один порядок не выражает и разрывается на самом мелком пересечении.
 */
const CYCLE_AREA_LIMIT = 100

/** Площадь со знаком: положительна у обхода против часовой стрелки. */
const getArea = (polygon: readonly PlaneVector[]): number =>
  polygon.reduce((sum, point, index) => {
    const next = polygon[(index + 1) % polygon.length]

    return sum + point.x * next.y - next.x * point.y
  }, 0) / 2

/** Пересечение двух выпуклых многоугольников отсечением по полуплоскостям второго. */
const intersect = (subject: readonly PlaneVector[], clip: readonly PlaneVector[]): PlaneVector[] => {
  const orientation = getArea(clip) >= 0 ? 1 : -1
  let result = [...subject]

  for (let index = 0; index < clip.length && result.length > 0; index++) {
    const a = clip[index]
    const b = clip[(index + 1) % clip.length]
    const side = (point: PlaneVector) => orientation * ((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x))
    const next: PlaneVector[] = []

    result.forEach((point, position) => {
      const following = result[(position + 1) % result.length]
      const inside = side(point) >= 0

      if (inside) next.push(point)
      if (inside !== side(following) >= 0) {
        const share = side(point) / (side(point) - side(following))

        next.push({ x: point.x + (following.x - point.x) * share, y: point.y + (following.y - point.y) * share })
      }
    })

    result = next
  }

  return result
}

/**
 * Параметр входа луча в призму предмета: луч проходит через точку экрана, `t` растёт от игрока.
 * Призма — сечение предмета, вытянутое по глубине от `near` до `far`.
 */
const enter = (item: DepthItem, screen: ScreenPoint): number | undefined => {
  const origin = screenToGround(screen)
  let from = (item.near - origin.x) / RAY.x
  let to = (item.far - origin.x) / RAY.x

  if (from > to) [from, to] = [to, from]

  const polygon = item.section
  const orientation = getArea(polygon) >= 0 ? 1 : -1

  for (let index = 0; index < polygon.length; index++) {
    const a = polygon[index]
    const b = polygon[(index + 1) % polygon.length]
    const ex = (b.x - a.x) * orientation
    const ey = (b.y - a.y) * orientation
    // Точка луча в плоскости сечения: (origin.y + t·RAY.y, t·RAY.z); внутри — слева от ребра
    const constant = ex * -a.y - ey * (origin.y - a.x)
    const slope = ex * RAY.z - ey * RAY.y

    if (Math.abs(slope) < 1e-12) {
      if (constant < 0) return undefined
    } else if (slope > 0) {
      from = Math.max(from, -constant / slope)
    } else {
      to = Math.min(to, -constant / slope)
    }
  }

  return from < to - RAY_TOLERANCE ? from : undefined
}

/** Кто ближе по лучам через общую часть силуэтов: 1 — `first`, −1 — `second`, 0 — лучи не различают. */
const traceOrder = (first: DepthItem, second: DepthItem): number => {
  const common = intersect(first.outline, second.outline)

  if (common.length < 3) return 0

  const center = {
    x: common.reduce((sum, { x }) => sum + x, 0) / common.length,
    y: common.reduce((sum, { y }) => sum + y, 0) / common.length,
  }
  const samples = [center, ...common.map(({ x, y }) => ({ x: center.x + (x - center.x) * 0.6, y: center.y + (y - center.y) * 0.6 }))]

  for (const sample of samples) {
    const a = enter(first, sample)
    const b = enter(second, sample)

    if (a !== undefined && b !== undefined && Math.abs(a - b) > RAY_TOLERANCE) return a < b ? 1 : -1
  }

  return 0
}

/** Предмет игрушки без крена, центр которой стоит в срезе `slab` на высоте `z`. */
const toy = (shape: ShapeKey, slab: number, y: number, z: number, variant = 0): DepthItem =>
  getToyDepthItem(shape, variant, { x: getDepthCenter(slab, getVariant(shape, variant).depth), y, z }, 0)

/** Порядок отрисовки предметов, от дальнего к ближнему, со сравнением каждой пары заново. */
const sortByDepth = (items: readonly DepthItem[]): number[] =>
  orderByDepth(items, (first, second) => getDepthRelation(items[first], items[second]))

/** Ранги предметов в порядке отрисовки: больший рисуется позже. */
const rank = (items: readonly DepthItem[]): number[] => {
  const ranks = new Array<number>(items.length)

  sortByDepth(items).forEach((index, position) => {
    ranks[index] = position
  })

  return ranks
}

describe('порядок наложения', () => {
  it('совпадает с порядком по лучам на пересекающихся парах игрушек реальных куч', () => {
    let pairs = 0
    let relationErrors = 0
    let largestBreak = 0

    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const heap = new HeapStore()

      heap.restore(undefined, createRandom(seed))

      const items = [...heap.getBodies()].map((body) =>
        getToyDepthItem(body.shape, body.variant, body.pose.point, body.pose.angle)
      )
      const ranks = rank(items)

      for (let first = 0; first < items.length; first++) {
        for (let second = first + 1; second < items.length; second++) {
          const relation = getDepthRelation(items[first], items[second])
          const truth = relation === 0 ? 0 : traceOrder(items[first], items[second])

          if (truth === 0) continue

          pairs += 1
          if (Math.sign(relation) !== truth) relationErrors += 1
          if (Math.sign(ranks[first] - ranks[second]) !== truth) {
            largestBreak = Math.max(largestBreak, Math.abs(getArea(intersect(items[first].outline, items[second].outline))))
          }
        }
      }
    }

    expect(pairs).toBeGreaterThan(1000)
    expect(relationErrors).toBe(0)
    expect(largestBreak).toBeLessThan(CYCLE_AREA_LIMIT)
  })

  it('рисует верхнюю игрушку стопки поверх нижних', () => {
    const items = [0.4, 1.2, 2.0].map((z) => toy('single', 3, 4, z))
    const ranks = rank(items)

    expect(ranks[1]).toBeGreaterThan(ranks[0])
    expect(ranks[2]).toBeGreaterThan(ranks[1])
  })

  it('рисует игрушку ближнего среза поверх дальнего', () => {
    const ranks = rank([4, 3, 2].map((slab) => toy('single', slab, 4, 0.5)))

    expect(ranks[1]).toBeGreaterThan(ranks[0])
    expect(ranks[2]).toBeGreaterThan(ranks[1])
  })

  it('ставит игрушку на два среза между соседями обоих срезов', () => {
    const cube = toy('cube8', 3, 4, 0.9)
    const onTop = toy('single', 3, 4, 2.2)
    const behind = toy('bar2', 5, 4, 0.5)
    const ranks = rank([cube, onTop, behind])

    expect(ranks[1]).toBeGreaterThan(ranks[0])
    expect(ranks[0]).toBeGreaterThan(ranks[2])
  })

  it('прячет за дальней стенкой лотка то, что лежит за ней, и показывает перед ней игрушку в шахте', () => {
    const [far] = getTrayWallOutlines()
    const wall = getPlaneDepthItem(far)
    const behind = toy('single', 2, 7, 0.5)
    const falling = toy('single', 1, 7, 0.8)

    expect(getDepthRelation(wall, behind)).toBeGreaterThan(0)
    expect(getDepthRelation(falling, wall)).toBeGreaterThan(0)
  })

  it('проводит ребро ближнего угла куба перед игрушкой, а ребро дальнего — за ней', () => {
    const edge = (corner: WorldPoint) => getPlaneDepthItem([corner, { ...corner, z: CUBE_HEIGHT }])
    const [near, , far] = getFaceOutline(0).map(edge)

    expect(getDepthRelation(near, toy('single', 0, 0.45, 1))).toBeGreaterThan(0)
    expect(getDepthRelation(far, toy('single', GRID_SIZE - 1, GRID_SIZE - 0.45, 1))).toBeLessThan(0)
  })

  it('рисует клешню над игрушкой, на которую она опускается, и прячет её за игрушкой ближнего среза', () => {
    const below = toy('cube8', 3, 4, 0.9)
    const claw = getPointDepthItem({ x: 4, y: 4, z: 2 }, 16, 0.25)
    const front = toy('cube8', 0, 4, 1.8)
    const distant = getPointDepthItem({ x: 6.5, y: 4, z: 1.5 }, 16, 0.25)

    expect(getDepthRelation(claw, below)).toBeGreaterThan(0)
    expect(getDepthRelation(front, distant)).toBeGreaterThan(0)
  })
})
