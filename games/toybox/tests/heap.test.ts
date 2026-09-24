// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import {
  CUBE_HEIGHT,
  GRID_SIZE,
  HEAP_SNAPSHOT_VERSION,
  TOY_INSET,
  TRAY_CENTER,
  FUMBLE_START_CLEARANCE,
  TRAY_ORIGIN,
  TRAY_SIZE,
  TRAY_WALL_HEIGHT,
} from '#src/constants'
import { DOME_CENTER_HEIGHT } from '#src/heap/constants'
import { isHeapSnapshot } from '#src/heap/utils'
import { SHAPE_KEYS, SHAPES } from '#src/toys'
import type { GroundPoint, PlaneVector, ScreenPoint } from '#src/types'
import { getTrayWallOutlines } from '#src/utils/machine-geometry'
import { pickFumbleShare } from '#src/utils/motion'
import { getDepthOrder, worldToScreen } from '#src/utils/projection'
import { getPrismOutline, getSection, getSectionArea, getVariantCount, getWeight } from '#src/utils/shapes'
import { createRandom } from '@pixi-demos/core/random'

/** Сколько падений разыгрывать там, где проверяется доля исходов, а не одно конкретное. */
const ROLLS = 200

/** Лежит ли точка пола над лотком. */
const isOverTray = ({ x, y }: GroundPoint): boolean =>
  x >= TRAY_ORIGIN.x && x <= TRAY_ORIGIN.x + TRAY_SIZE && y >= TRAY_ORIGIN.y && y <= TRAY_ORIGIN.y + TRAY_SIZE

describe('getDepthOrder', () => {
  it('ставит верхнюю точку стопки ближе к игроку, чем нижние', () => {
    const stack = [0.5, 1.5, 2.5, 3.5].map((z) => getDepthOrder({ x: 4, y: 4, z }))

    for (let index = 1; index < stack.length; index++) {
      expect(stack[index]).toBeGreaterThan(stack[index - 1])
    }
  })

  it('ставит ближнюю по осям поля ячейку ближе к игроку', () => {
    const far = getDepthOrder({ x: 4, y: 4, z: 0 })

    expect(getDepthOrder({ x: 3, y: 4, z: 0 })).toBeGreaterThan(far)
    expect(getDepthOrder({ x: 4, y: 3, z: 0 })).toBeGreaterThan(far)
  })

  it('разводит точки, которые заслоняют друг друга на экране', () => {
    // Обе точки лежат на одном луче взгляда и проецируются в одно место: заслоняет ближняя
    const near = { x: 0, y: 0, z: 1 }
    const far = { x: 128 / 17, y: 16 / 17, z: 0 }

    expect(worldToScreen(near)).toEqual(worldToScreen(far))
    expect(getDepthOrder(near)).toBeGreaterThan(getDepthOrder(far))
  })

  it('растёт монотонно по каждой оси', () => {
    const at = (x: number, y: number, z: number) => getDepthOrder({ x, y, z })

    for (let step = 1; step < GRID_SIZE; step++) {
      // Ближе к игроку — меньше по осям поля и выше по z
      expect(at(step - 1, 4, 1)).toBeGreaterThan(at(step, 4, 1))
      expect(at(4, step - 1, 1)).toBeGreaterThan(at(4, step, 1))
    }

    for (let height = 1; height <= CUBE_HEIGHT; height++) {
      expect(at(4, 4, height)).toBeGreaterThan(at(4, 4, height - 1))
    }
  })
})

describe('pickFumbleShare', () => {
  const FROM: GroundPoint = { x: 4, y: 4 }
  const at = (share: number): GroundPoint => ({
    x: FROM.x + (TRAY_CENTER.x - FROM.x) * share,
    y: FROM.y + (TRAY_CENTER.y - FROM.y) * share,
  })

  it('роняет игрушку над кубом: дальше порога от места захвата и до входа в лоток', () => {
    const random = createRandom(2)

    for (let run = 0; run < ROLLS; run++) {
      const share = pickFumbleShare(FROM, TRAY_CENTER, random) as number
      const point = at(share)

      expect(Math.hypot(point.x - FROM.x, point.y - FROM.y)).toBeGreaterThanOrEqual(FUMBLE_START_CLEARANCE - 1e-9)
      expect(isOverTray(point)).toBe(false)
    }
  })

  it('покрывает весь допустимый участок пути', () => {
    const shares = [0, 0.999999].map((roll) => pickFumbleShare(FROM, TRAY_CENTER, () => roll) as number)

    expect(isOverTray(at(shares[1] + 0.01))).toBe(true)
    expect(Math.hypot(at(shares[0]).x - FROM.x, at(shares[0]).y - FROM.y)).toBeCloseTo(FUMBLE_START_CLEARANCE, 9)
  })

  it('не отдаёт ничего, когда ронять по дороге негде', () => {
    // Путь начинается над лотком или короче порога: участка над кубом на нём нет
    expect(pickFumbleShare(TRAY_CENTER, { x: 4, y: 4 }, createRandom(4))).toBeUndefined()
    expect(pickFumbleShare({ x: 2.5, y: 6.5 }, TRAY_CENTER, createRandom(4))).toBeUndefined()
  })
})

describe('getTrayWallOutlines', () => {
  it('отгораживает лоток двумя гранями, которых не закрывает сам куб', () => {
    const [far, near] = getTrayWallOutlines()

    // Грань вдоль оси y стоит на границе лотка в глубину, грань вдоль оси x — на его ближней к куче стороне
    expect(far.every(({ x }) => x === TRAY_ORIGIN.x + TRAY_SIZE)).toBe(true)
    expect(near.every(({ y }) => y === TRAY_ORIGIN.y)).toBe(true)
  })

  it('поднимает стенки ниже верха кучи: игрушка через них переваливается', () => {
    for (const outline of getTrayWallOutlines()) {
      expect(outline.map(({ z }) => z).sort()).toEqual([0, 0, TRAY_WALL_HEIGHT, TRAY_WALL_HEIGHT])
    }

    expect(TRAY_WALL_HEIGHT).toBeLessThan(DOME_CENTER_HEIGHT)
  })

  it('не рисует грани, которыми лоток прилегает к стенкам куба', () => {
    const outlines = getTrayWallOutlines()

    expect(outlines).toHaveLength(2)
    expect(outlines.some((outline) => outline.every(({ x }) => x === TRAY_ORIGIN.x))).toBe(false)
    expect(outlines.some((outline) => outline.every(({ y }) => y === GRID_SIZE))).toBe(false)
  })
})

/** Лежит ли точка внутри выпуклого многоугольника или на его границе. */
const isInside = (polygon: readonly PlaneVector[], point: PlaneVector): boolean => {
  const sides = polygon.map((corner, index) => {
    const next = polygon[(index + 1) % polygon.length]

    return (next.x - corner.x) * (point.y - corner.y) - (next.y - corner.y) * (point.x - corner.x)
  })

  return sides.every((side) => side >= -1e-9) || sides.every((side) => side <= 1e-9)
}

/** Все положения всех форм каталога. */
const VARIANTS = SHAPE_KEYS.flatMap((shape) =>
  Array.from({ length: getVariantCount(shape) }, (_, variant) => ({ shape, variant }))
)

describe('getWeight', () => {
  it('держит веса форм по их прежнему числу клеток', () => {
    expect(SHAPE_KEYS.map((shape) => [shape, getWeight(shape)])).toEqual([
      ['single', 1],
      ['bar2', 2],
      ['square4', 4],
      ['cube8', 8],
      ['triangle', 3],
    ])
  })
})

describe('getSection', () => {
  const toPlanePoints = (shape: (typeof VARIANTS)[number]): PlaneVector[] =>
    getSection(shape.shape, shape.variant).map(({ y, z }) => ({ x: y, y: z }))

  it('даёт выпуклое сечение не длиннее предела вершин многоугольника planck', () => {
    for (const variant of VARIANTS) {
      const polygon = toPlanePoints(variant)

      expect(polygon.length).toBeGreaterThanOrEqual(3)
      expect(polygon.length).toBeLessThanOrEqual(12)
      for (const point of polygon) expect(isInside(polygon, point)).toBe(true)
    }
  })

  it('ставит центр масс сечения в центр игрушки', () => {
    for (const { shape, variant } of VARIANTS) {
      const section = getSection(shape, variant)
      const area = getSectionArea(section)
      const center = section.reduce(
        (sum, point, index) => {
          const next = section[(index + 1) % section.length]
          const cross = point.y * next.z - next.y * point.z

          return { y: sum.y + (point.y + next.y) * cross, z: sum.z + (point.z + next.z) * cross }
        },
        { y: 0, z: 0 }
      )

      expect(Math.abs(center.y / (6 * area))).toBeLessThan(1e-9)
      expect(Math.abs(center.z / (6 * area))).toBeLessThan(1e-9)
    }
  })

  it('укладывает сечение в габарит многоугольника каталога с зазором TOY_INSET', () => {
    for (const { shape, variant } of VARIANTS) {
      const base = SHAPES[shape].variants[variant].section
      const width = Math.max(...base.map(({ y }) => y)) - Math.min(...base.map(({ y }) => y))
      const height = Math.max(...base.map(({ z }) => z)) - Math.min(...base.map(({ z }) => z))
      const section = getSection(shape, variant)

      expect(Math.max(...section.map(({ y }) => y)) - Math.min(...section.map(({ y }) => y))).toBeLessThanOrEqual(
        width * TOY_INSET + 1e-9
      )
      expect(Math.max(...section.map(({ z }) => z)) - Math.min(...section.map(({ z }) => z))).toBeLessThanOrEqual(
        height * TOY_INSET + 1e-9
      )
    }
  })
})

describe('getPrismOutline', () => {
  it('накрывает сечение на ближней и дальней границе глубины при любом крене', () => {
    for (const { shape, variant } of VARIANTS) {
      const section = getSection(shape, variant)
      const {depth} = SHAPES[shape].variants[variant]

      for (const angle of [0, 0.7, 2.4, -1.3]) {
        const outline = getPrismOutline(section, depth, angle)
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)

        for (const x of [(-depth * TOY_INSET) / 2, (depth * TOY_INSET) / 2]) {
          for (const { y, z } of section) {
            const point: ScreenPoint = worldToScreen({ x, y: y * cos - z * sin, z: y * sin + z * cos })

            expect(isInside(outline, point)).toBe(true)
          }
        }
      }
    }
  })
})

describe('isHeapSnapshot', () => {
  const body = { shape: 'cube8', variant: 0, slab: 3, y: 4, z: 0.9, angle: 0.3, color: 0xffa24b }
  const snapshot = { version: HEAP_SNAPSHOT_VERSION, collected: 3, bodies: [body] }
  const withBody = (patch: Record<string, unknown>) => ({ ...snapshot, bodies: [{ ...body, ...patch }] })

  it('принимает снимок своей версии', () => {
    expect(isHeapSnapshot(snapshot)).toBe(true)
    expect(isHeapSnapshot({ ...snapshot, bodies: [] })).toBe(true)
  })

  it('отбрасывает чужую версию, мусор и незнакомую форму', () => {
    expect(isHeapSnapshot({ ...snapshot, version: HEAP_SNAPSHOT_VERSION - 1 })).toBe(false)
    expect(isHeapSnapshot(undefined)).toBe(false)
    expect(isHeapSnapshot('heap')).toBe(false)
    expect(isHeapSnapshot(withBody({ shape: 'pyramid' }))).toBe(false)
    expect(isHeapSnapshot(withBody({ shape: 'ell3' }))).toBe(false)
    expect(isHeapSnapshot(withBody({ shape: 'toString' }))).toBe(false)
  })

  it('отбрасывает положение вне каталога и срез, из которого игрушка выходит за куб', () => {
    expect(isHeapSnapshot(withBody({ variant: 1 }))).toBe(false)
    expect(isHeapSnapshot(withBody({ variant: 0.5 }))).toBe(false)
    expect(isHeapSnapshot(withBody({ slab: GRID_SIZE - 1 }))).toBe(false)
    expect(isHeapSnapshot(withBody({ slab: -1 }))).toBe(false)
  })

  it.each([NaN, Infinity, -0.5, GRID_SIZE + 0.5])('отбрасывает координату %s', (value) => {
    expect(isHeapSnapshot(withBody({ y: value }))).toBe(false)
    expect(isHeapSnapshot(withBody({ z: value === GRID_SIZE + 0.5 ? CUBE_HEIGHT + 0.5 : value }))).toBe(false)
  })
})
