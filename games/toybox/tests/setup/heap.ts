import { expect, inject } from 'vitest'

import { CLAW_REST_HEIGHT } from '#src/claw/constants'
import { CLAW_GRAB_MS, FIELD_CENTER, GRID_SIZE } from '#src/constants'
import { Heap } from '#src/heap/heap'
import type { ToyPile } from '#src/heap/toy-pile'
import { type ToyBody, ToyState } from '#src/heap/types'
import type { GroundPoint, HeapSnapshotBody, ToyId, ToyKey, WorldPoint } from '#src/types'
import { polygonsOverlap } from '#src/utils/geometry'
import { getContactSection, getDepth, getSection, placeSection, toPlane } from '#src/utils/shapes'

/** Шаг кадра при 60 fps. */
export const FRAME_MS = 1000 / 60

/** Предохранитель: куча, которая не встала за столько кадров, считается зациклившейся. */
const MAX_FRAMES = 10_000

/** Допуск пересечения тел: движок держит касание с проникновением порядка своего допуска. */
const OVERLAP_TOLERANCE = 0.05

/** Точка захвата пустой клешни в покое: её получает кадровый шаг, пока игрушки в клешне нет. */
export const REST_GRIP: WorldPoint = { ...FIELD_CENTER, z: CLAW_REST_HEIGHT }

/** Куча, насыпанная `pourHeap` по сиду из `tests/setup/global.ts`. */
export const getPouredHeap = (seed: number): HeapSnapshotBody[] => {
  const bodies = inject('heaps')[seed]

  if (!bodies) throw new Error(`No poured heap for seed ${seed}`)

  return structuredClone(bodies)
}

/** Куча из снимка: сцена руками или насыпанная куча. */
export const createHeap = (bodies: readonly HeapSnapshotBody[]): Heap => {
  const heap = new Heap()

  heap.restore(bodies)

  return heap
}

/** Нижняя и верхняя границы сечения относительно центра игрушки. */
const getExtent = (toy: ToyKey): { bottom: number; top: number } => {
  const heights = getSection(toy).map(({ z }) => z)

  return { bottom: Math.min(...heights), top: Math.max(...heights) }
}

/** Игрушка снимка без крена, стоящая в срезе `slab` на высоте `floor`. */
export const stand = (toy: ToyKey, slab: number, y: number, floor: number): HeapSnapshotBody => ({
  slab,
  y,
  z: floor - getExtent(toy).bottom + 0.001,
  angle: 0,
  toy,
})

/** Верх игрушки снимка, стоящей без крена. */
export const topOf = ({ toy, z }: HeapSnapshotBody): number => z + getExtent(toy).top

/** Сечение игрушки в её позе как фигура плоскости `(y, z)`. */
export const sectionOf = (body: Readonly<ToyBody>) =>
  toPlane(placeSection(getSection(body.toy), { ...body.pose.point, angle: body.pose.angle }))

/** Сечение касания игрушки в её позе: им игрушки упираются друг в друга. */
const contactOf = (body: Readonly<ToyBody>) =>
  toPlane(placeSection(getContactSection(body.toy), { ...body.pose.point, angle: body.pose.angle }))

const shareSlab = (first: Readonly<ToyBody>, second: Readonly<ToyBody>): boolean =>
  first.slab < second.slab + getDepth(second.toy) && second.slab < first.slab + getDepth(first.toy)

export const findBody = (heap: Heap, id: ToyId | undefined): Readonly<ToyBody> => {
  const body = [...heap.getBodies()].find((candidate) => candidate.id === id)

  if (!body) throw new Error(`No toy ${id}`)

  return body
}

/** Рамка, в которой лежит куча: края по оси `y` и высота пола. */
export type PileBounds = {
  readonly minY: number
  readonly maxY: number
  readonly floor: number
}

/** Рамка кучи в кубе. */
const CUBE_BOUNDS: PileBounds = { minY: 0, maxY: GRID_SIZE, floor: 0 }

/** Проверяет то, что верно про любую кучу в покое: позы конечны, игрушки в своей рамке и не пересекаются. */
export const expectSoundHeap = (pile: ToyPile, { minY, maxY, floor }: PileBounds = CUBE_BOUNDS): void => {
  const bodies = [...pile.getBodies()].filter((body) => body.state === ToyState.free)

  for (const body of bodies) {
    const { point, angle } = body.pose

    expect([point.x, point.y, point.z, angle].every(Number.isFinite)).toBe(true)

    for (const { x: y, y: z } of sectionOf(body)) {
      expect(y).toBeGreaterThan(minY - OVERLAP_TOLERANCE)
      expect(y).toBeLessThan(maxY + OVERLAP_TOLERANCE)
      expect(z).toBeGreaterThan(floor - OVERLAP_TOLERANCE)
    }
  }

  for (let first = 0; first < bodies.length; first++) {
    for (let second = first + 1; second < bodies.length; second++) {
      if (!shareSlab(bodies[first], bodies[second])) continue

      expect(polygonsOverlap(contactOf(bodies[first]), contactOf(bodies[second]), OVERLAP_TOLERANCE)).toBe(false)
    }
  }
}

/** Крутит кадры, пока куча не придёт в покой. */
export const settle = (heap: Heap, deltaMs = FRAME_MS): void => {
  for (let frame = 0; frame < MAX_FRAMES; frame++) {
    heap.advance(deltaMs, REST_GRIP)

    if (heap.settled) return
  }

  throw new Error('Heap never settled')
}

/** Снимает игрушку под точкой и поднимает её на высоту покоя клешни; отвечает её id. */
export const liftToRest = (heap: Heap, point: GroundPoint): ToyId | undefined => {
  const grip = { ...point, z: heap.getSurfaceHeightAt(point) }
  const id = heap.getTopBodyAt(point)?.id

  if (!heap.lift(point, grip)) return undefined

  heap.advance(CLAW_GRAB_MS, grip)

  for (let { z } = grip; z < CLAW_REST_HEIGHT; z += 0.25) heap.advance(FRAME_MS, { ...point, z })

  return id
}
