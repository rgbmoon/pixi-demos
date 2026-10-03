// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CABINET_BOTTOM_Z,
  CUBE_HEIGHT,
  FIELD_CENTER,
  FLOOR_PILE_WIDTH,
  FUMBLE_CHANCE,
  GRID_SIZE,
  HEAP_SNAPSHOT_VERSION,
  LIFT_FUMBLE_CHANCE,
} from '#src/constants'
import { PersistenceController } from '#src/controllers/persistence'
import { isHeapSnapshot } from '#src/heap/utils'
import { PhaseName } from '#src/types'

import { type Cycle, createCycle, getGrabRolls, startCycle } from './setup/cycle'
import { expectSoundHeap, stand, topOf } from './setup/heap'

/** Броски, на которых игрушка не выскальзывает на подъёме и не теряется по дороге. */
const SLIP_MISS = (1 + LIFT_FUMBLE_CHANCE) / 2
const FUMBLE_MISS = (1 + FUMBLE_CHANCE) / 2

/** Под кареткой в покое стоит куб с мячом наверху. */
const cube = stand('teddy', 3, FIELD_CENTER.y, 0)
const ball = stand('dolphin', 4, FIELD_CENTER.y, topOf(cube))
const SCENE = [cube, ball]

/** На полу справа от тумбы, за краем куба, лежит выигранный брусок. */
const FLOOR = [stand('giraffe', 2, -2, CABINET_BOTTOM_Z)]

const getIds = (cycle: Cycle): Set<number> => new Set([...cycle.heap.getBodies()].map(({ id }) => id))

describe('сессия', () => {
  let cycle: Cycle | undefined
  let persistence: PersistenceController | undefined

  afterEach(async () => {
    persistence?.destroy({ children: true })
    persistence = undefined
    await cycle?.stop()
    cycle = undefined
  })

  describe('загрузка', () => {
    it('поднимает кучу, игрушки на полу и счёт из сохранённого снимка и объявляет игру готовой', async () => {
      const booted = vi.fn()

      cycle = createCycle({ bodies: SCENE, floor: FLOOR, collected: 5 })
      cycle.emitter.on('game:booted', booted)
      await cycle.start()

      expect(booted).toHaveBeenCalledOnce()
      expect(cycle.heap.takeSnapshot()).toEqual(SCENE)
      expect(cycle.floorPile.takeSnapshot()).toEqual(FLOOR)
      expect(cycle.store.collected).toBe(5)
      expect(cycle.store.checkpoint).toEqual({
        version: HEAP_SNAPSHOT_VERSION,
        collected: 5,
        bodies: SCENE,
        floor: FLOOR,
      })
    })

    it('оставляет пустой сохранённый куб пустым, а не насыпает его заново', async () => {
      cycle = await startCycle({ bodies: [], collected: 7 })

      expect(cycle.heap.takeSnapshot()).toEqual([])
      expect(cycle.store.collected).toBe(7)
    })

    it.each([
      ['ничего не сохранено', undefined],
      ['снимок другой версии', { version: HEAP_SNAPSHOT_VERSION - 1, collected: 5, bodies: SCENE }],
      ['в хранилище мусор', 'heap'],
    ])('насыпает новую кучу и обнуляет счёт, когда %s', async (_, stored) => {
      cycle = await startCycle({ stored })

      expect(cycle.heap.takeSnapshot().length).toBeGreaterThan(0)
      expectSoundHeap(cycle.heap)
      expect(cycle.store.collected).toBe(0)
      expect(cycle.store.checkpoint).toEqual({
        version: HEAP_SNAPSHOT_VERSION,
        collected: 0,
        bodies: cycle.heap.takeSnapshot(),
        floor: [],
      })
    })
  })

  describe('проверка снимка из хранилища', () => {
    const body = { slab: 3, y: 4, z: 0.9, angle: 0.3, toy: 'teddy' }
    const snapshot = { version: HEAP_SNAPSHOT_VERSION, collected: 3, bodies: [body], floor: [] }
    const withBody = (patch: Record<string, unknown>) => ({ ...snapshot, bodies: [{ ...body, ...patch }] })

    it('принимает снимок своей версии, в том числе пустой', () => {
      expect(isHeapSnapshot(snapshot)).toBe(true)
      expect(isHeapSnapshot({ ...snapshot, bodies: [] })).toBe(true)
    })

    it('принимает игрушку пола за краем куба и отбрасывает игрушку за краем полосы пола или снимок без пола', () => {
      const floorBody = (y: number) => ({ ...snapshot, floor: [{ ...FLOOR[0], y }] })
      const { floor: _, ...withoutFloor } = snapshot

      expect(isHeapSnapshot(floorBody(-2))).toBe(true)
      expect(isHeapSnapshot(floorBody((GRID_SIZE - FLOOR_PILE_WIDTH) / 2 - 0.5))).toBe(false)
      expect(isHeapSnapshot(withoutFloor)).toBe(false)
    })

    it('отбрасывает чужую версию, мусор и игрушку вне каталога', () => {
      expect(isHeapSnapshot({ ...snapshot, version: HEAP_SNAPSHOT_VERSION - 1 })).toBe(false)
      expect(isHeapSnapshot(undefined)).toBe(false)
      expect(isHeapSnapshot('heap')).toBe(false)
      expect(isHeapSnapshot(withBody({ toy: 'unicorn' }))).toBe(false)
      expect(isHeapSnapshot(withBody({ toy: 'toString' }))).toBe(false)
      expect(isHeapSnapshot(withBody({ toy: undefined }))).toBe(false)
    })

    it('отбрасывает срез, из которого игрушка выходит за куб', () => {
      expect(isHeapSnapshot(withBody({ slab: GRID_SIZE - 1 }))).toBe(false)
      expect(isHeapSnapshot(withBody({ slab: -1 }))).toBe(false)
    })

    it('принимает отметку лампы табло и отбрасывает её не флагом', () => {
      expect(isHeapSnapshot(withBody({ hasLamp: true }))).toBe(true)
      expect(isHeapSnapshot(withBody({ hasLamp: 1 }))).toBe(false)
    })

    it.each([NaN, Infinity, -0.5, GRID_SIZE + 0.5])('отбрасывает координату %s', (value) => {
      expect(isHeapSnapshot(withBody({ y: value }))).toBe(false)
      expect(isHeapSnapshot(withBody({ z: value === GRID_SIZE + 0.5 ? CUBE_HEIGHT + 0.5 : value }))).toBe(false)
    })
  })

  describe('сброс', () => {
    it('насыпает новую кучу, убирает игрушки с пола и обнуляет счёт, не выходя из покоя', async () => {
      const reset = vi.fn()

      cycle = await startCycle({ bodies: SCENE, floor: FLOOR, collected: 3 })

      const before = getIds(cycle)
      const phases = cycle.phases.length

      cycle.emitter.on('heap:reset', reset)
      cycle.emitter.emit('ui:resetRequested')

      expect(reset).toHaveBeenCalledOnce()
      expect([...getIds(cycle)].some((id) => before.has(id))).toBe(false)
      expect(cycle.heap.takeSnapshot().length).toBeGreaterThan(0)
      expect(cycle.floorPile.takeSnapshot()).toEqual([])
      expect(cycle.store.collected).toBe(0)
      expect(cycle.store.checkpoint).toEqual({
        version: HEAP_SNAPSHOT_VERSION,
        collected: 0,
        bodies: cycle.heap.takeSnapshot(),
        floor: [],
      })
      expect(cycle.phases).toHaveLength(phases)

      // Сброс не снимает ожидание опускания: новая куча играется сразу
      cycle.rolls.push(getGrabRolls(cycle).miss)

      expect(await cycle.playRound()).toContain(PhaseName.descending)
    })

    it('не сбрасывает кучу посреди раунда', async () => {
      const reset = vi.fn()

      cycle = await startCycle({ bodies: SCENE, collected: 3 })

      const before = getIds(cycle)
      const current = cycle

      current.emitter.on('heap:reset', reset)
      current.rolls.push(getGrabRolls(current).miss)
      current.emitter.emit('ui:dropRequested')
      await current.runUntil(() => current.store.phase === PhaseName.grabbing)
      current.emitter.emit('ui:resetRequested')
      await current.runUntil(() => current.store.isIdle)

      expect(reset).not.toHaveBeenCalled()
      expect(getIds(current)).toEqual(before)
      expect(current.store.collected).toBe(3)
    })
  })

  describe('сохранение', () => {
    it('записывает кучу и счёт после раунда, а посреди раунда хранит кучу до раунда', async () => {
      cycle = createCycle({ bodies: SCENE })
      persistence = new PersistenceController(cycle.store, cycle.storage)

      const current = cycle

      await current.start()

      expect(current.writes).toEqual([{ version: HEAP_SNAPSHOT_VERSION, collected: 0, bodies: SCENE, floor: [] }])

      current.rolls.push(getGrabRolls(current).hit, SLIP_MISS, FUMBLE_MISS)
      current.emitter.emit('ui:dropRequested')
      await current.runUntil(() => current.store.phase === PhaseName.delivering)

      // Игрушка в клешне, а в хранилище куча до раунда: уход со страницы сейчас не потеряет игрушку
      expect(current.heap.isHolding).toBe(true)
      expect(current.writes).toHaveLength(1)

      await current.runUntil(() => current.store.isIdle)

      expect(current.writes).toHaveLength(2)
      expect(current.writes[1]).toEqual({
        version: HEAP_SNAPSHOT_VERSION,
        collected: 1,
        bodies: current.heap.takeSnapshot(),
        floor: current.floorPile.takeSnapshot(),
      })
    })
  })
})
