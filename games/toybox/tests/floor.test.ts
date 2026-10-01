import { afterEach, describe, expect, it, vi } from 'vitest'

import { CABINET_BOTTOM_Z, CABINET_FRONT_X, FLOOR_PILE_DEPTH, FLOOR_PILE_WIDTH, GRID_SIZE } from '#src/constants'
import { FloorPile } from '#src/heap/floor-pile'
import { SHAPE_KEYS } from '#src/toys'
import type { HeapSnapshotBody, ToyAppearance } from '#src/types'
import { getVariant } from '#src/utils/shapes'
import { createRandom } from '@pixi-demos/core/random'
import type { Random } from '@pixi-demos/core/types'

import { expectSoundHeap, FRAME_MS, type PileBounds, sectionOf } from './setup/heap'

/** Предохранитель: пол, который не успокоился за столько кадров, считается зациклившимся. */
const MAX_FRAMES = 10_000

/** Пауза между выпадениями призов подряд: следующий приз выпадает, пока предыдущий ещё катится. */
const PRESENTATION_FRAMES = 72

/** Полоса пола перед тумбой: середина под серединой куба. */
const FLOOR_BOUNDS: PileBounds = {
  minY: (GRID_SIZE - FLOOR_PILE_WIDTH) / 2,
  maxY: (GRID_SIZE + FLOOR_PILE_WIDTH) / 2,
  floor: CABINET_BOTTOM_Z,
}

const PRIZE: ToyAppearance = { shape: 'cube8', color: 0x3366ff }

/** Крутит кадры, пока пол не придёт в покой. */
const settle = (pile: FloorPile): void => {
  for (let frame = 0; frame < MAX_FRAMES; frame++) {
    pile.advance(FRAME_MS)

    if (pile.settled) return
  }

  throw new Error('Floor never settled')
}

/**
 * Роняет `count` призов подряд в темпе показа и ждёт покоя: формы идут по кругу каталога, срезы и толчки задаёт
 * генератор.
 */
const dropSeries = (pile: FloorPile, count: number, random: Random): HeapSnapshotBody[] => {
  for (let prize = 0; prize < count; prize++) {
    pile.drop({ shape: SHAPE_KEYS[prize % SHAPE_KEYS.length], color: prize }, random)

    for (let frame = 0; frame < PRESENTATION_FRAMES; frame++) pile.advance(FRAME_MS)
  }

  settle(pile)

  return pile.takeSnapshot()
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('пол: выпадение приза', () => {
  it('кладёт выпавший приз в покое на пол перед тумбой, в его срезы', () => {
    const pile = new FloorPile()

    pile.drop(PRIZE, createRandom(1))
    settle(pile)

    const [body] = pile.getBodies()
    const { depth } = getVariant(body.shape, body.variant)

    expect(body).toMatchObject({ shape: PRIZE.shape, color: PRIZE.color })
    expect(Math.min(...sectionOf(body).map(({ y }) => y))).toBeCloseTo(CABINET_BOTTOM_Z, 1)
    // Приз долетел от фасада до своих срезов
    expect(body.pose.point.x).toBe(CABINET_FRONT_X - (body.slab + depth / 2))
    expect(body.slab + depth).toBeLessThanOrEqual(FLOOR_PILE_DEPTH)
  })

  // Постоянный бросок толкает каждый приз к одному краю полосы: так проверяются её стенки
  it.each([
    ['случайных толчках', createRandom(2)],
    ['толчках к правому краю', () => 0],
    ['толчках к левому краю', () => 0.999],
  ])('держит серию призов при %s в полосе пола, над полом и без пересечений в общих срезах', (_, random) => {
    const pile = new FloorPile()

    expect(dropSeries(pile, 30, random)).toHaveLength(30)
    expectSoundHeap(pile, FLOOR_BOUNDS)
  })

  it('при уменьшенном движении кладёт приз на пол за один кадр', () => {
    const pile = new FloorPile()

    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    pile.drop(PRIZE, createRandom(1))
    pile.advance(FRAME_MS)

    expect(pile.settled).toBe(true)
  })
})

describe('пол: снимок', () => {
  it('переживает круг снимок — восстановление — снимок', () => {
    const snapshot = dropSeries(new FloorPile(), 12, createRandom(3))
    const restored = new FloorPile()

    restored.restore(snapshot)

    expect(restored.takeSnapshot()).toEqual(snapshot)
  })

  it('не снимает пол, пока приз летит к своим срезам или падает', () => {
    const pile = new FloorPile()

    pile.drop(PRIZE, createRandom(1))

    expect(() => pile.takeSnapshot()).toThrow('Heap is not settled')

    settle(pile)

    expect(() => pile.takeSnapshot()).not.toThrow()
  })
})
