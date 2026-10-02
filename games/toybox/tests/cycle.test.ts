// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import { CLAW_REACH, CLAW_REST_HEIGHT } from '#src/claw/constants'
import {
  CABINET_BOTTOM_Z,
  CLAW_RELEASE_MS,
  FIELD_CENTER,
  FUMBLE_CHANCE,
  FUMBLE_START_CLEARANCE,
  GRID_SIZE,
  HEAP_SNAPSHOT_VERSION,
  LIFT_FUMBLE_CHANCE,
  PRIZE_NICHE_FLOOR,
  TRAY_ORIGIN,
  TRAY_SIZE,
} from '#src/constants'
import { type GroundPoint, type HeapSnapshotBody, PhaseName } from '#src/types'
import { createRandom } from '@pixi-demos/core/random'

import { type Cycle, getGrabRolls, startCycle } from './setup/cycle'
import { expectSoundHeap, FRAME_MS, getPouredHeap, sectionOf, stand, topOf } from './setup/heap'

/** Броски, на которых клешня роняет игрушку по дороге и доносит её. */
const FUMBLE_HIT = FUMBLE_CHANCE / 2
const FUMBLE_MISS = (1 + FUMBLE_CHANCE) / 2

/** Броски, на которых игрушка выскальзывает на подъёме и удерживается. */
const SLIP_HIT = LIFT_FUMBLE_CHANCE / 2
const SLIP_MISS = (1 + LIFT_FUMBLE_CHANCE) / 2

/** Раунд с призом и раунд, в котором клешня приходит к лотку пустой. */
const DELIVERY = [
  PhaseName.descending,
  PhaseName.grabbing,
  PhaseName.ascending,
  PhaseName.delivering,
  PhaseName.releasing,
  PhaseName.presenting,
  PhaseName.returning,
  PhaseName.idle,
]
const EMPTY_HANDED = DELIVERY.filter((phase) => phase !== PhaseName.presenting)

/** Игрушка снимка своего цвета: по цвету приз отличается от соседей той же формы. */
const paint = (body: HeapSnapshotBody, color: number): HeapSnapshotBody => ({ ...body, color })

/** Цвет игрушек стопки на полу: по нему они отличаются от выпавшего приза. */
const STACK_COLOR = 0x22aa22

/** Под кареткой в покое стоит куб с мячом наверху, в стороне — треугольник; мяч зажигает лампу табло. */
const cube = paint(stand('cube8', 3, FIELD_CENTER.y, 0), 0x3366ff)
const ball = { ...paint(stand('single', 4, FIELD_CENTER.y, topOf(cube)), 0xff3366), hasLamp: true }
const triangle = paint(stand('triangle', 6, 2, 0), 0x33ff66)
const SCENE = [cube, ball, triangle]

/** Формы игрушек, оставшихся в куче. */
const getShapes = (cycle: Cycle): string[] => cycle.heap.takeSnapshot().map(({ shape }) => shape).sort()

/** Высота, на которой клешня сжималась. */
const getGrabHeight = (cycle: Cycle): number | undefined =>
  cycle.frames.find(({ phase }) => phase === PhaseName.grabbing)?.grip.z

const getDistance = (from: GroundPoint, to: GroundPoint): number => Math.hypot(to.x - from.x, to.y - from.y)

const isOverTray = ({ x, y }: GroundPoint): boolean =>
  x >= TRAY_ORIGIN.x && x <= TRAY_ORIGIN.x + TRAY_SIZE.x && y >= TRAY_ORIGIN.y && y <= TRAY_ORIGIN.y + TRAY_SIZE.y

describe('цикл клешни', () => {
  let cycle: Cycle | undefined

  afterEach(async () => {
    await cycle?.stop()
    cycle = undefined
  })

  it('начинает в покое: клешня висит над центром поля и готова к опусканию', async () => {
    cycle = await startCycle({ bodies: SCENE })

    expect(cycle.store.canDrop).toBe(true)
    expect(cycle.rig.getGripPoint()).toEqual({ ...FIELD_CENTER, z: CLAW_REST_HEIGHT })
  })

  it('доносит игрушку до лотка: приз выпадает на пол, счёт растёт, клешня возвращается, снимок публикуется', async () => {
    cycle = await startCycle({ bodies: SCENE })
    cycle.rolls.push(getGrabRolls(cycle).hit, SLIP_MISS, FUMBLE_MISS)

    expect(await cycle.playRound()).toEqual(DELIVERY)

    // Клешня садится ровно на верх игрушки под кареткой
    expect(getGrabHeight(cycle)).toBeCloseTo(topOf(ball), 6)
    // Счёт растёт перед показом приза, а табло узнаёт о получении до того, как дверца закроется
    expect(cycle.prizes).toEqual([{ shape: 'single', color: ball.color, hasLamp: true, collected: 1 }])
    expect(cycle.presentation).toEqual(['show', 'open', 'eject', 'prize:taken', 'close', 'hide'])
    expect(cycle.store.collected).toBe(1)
    expect(getShapes(cycle)).toEqual(['cube8', 'triangle'])
    // Приз лежит в покое на полу перед автоматом с отметкой лампы табло
    expect(cycle.floorPile.takeSnapshot()).toMatchObject([{ shape: 'single', color: ball.color, hasLamp: true }])
    expect(cycle.rig.getCartPoint()).toMatchObject(FIELD_CENTER)
    expect(cycle.rig.getGripPoint().z).toBe(CLAW_REST_HEIGHT)
    expect(cycle.store.checkpoint).toEqual({
      version: HEAP_SNAPSHOT_VERSION,
      collected: 1,
      bodies: cycle.heap.takeSnapshot(),
      floor: cycle.floorPile.takeSnapshot(),
    })
  })

  it('говорящий приз произносит реплику в открытом окне и только потом выпадает на пол', async () => {
    // Бросок реплики ниже её доли: приз говорит, и первая строка списка выпадает на тот же бросок
    cycle = await startCycle({ bodies: SCENE, random: () => 0.1 })
    cycle.rolls.push(getGrabRolls(cycle).hit, SLIP_MISS, FUMBLE_MISS)

    expect(await cycle.playRound()).toEqual(DELIVERY)
    expect(cycle.presentation).toEqual(['show', 'open', 'speak:Help', 'eject', 'prize:taken', 'close', 'hide'])
  })

  it('открывает шторку с толчком: стопка игрушек под окном выдачи рассыпается', async () => {
    const base = paint(stand('cube8', 0, PRIZE_NICHE_FLOOR.y, CABINET_BOTTOM_Z), STACK_COLOR)
    const middle = paint(stand('cube8', 0, PRIZE_NICHE_FLOOR.y, topOf(base)), STACK_COLOR)
    const top = paint(stand('cube8', 0, PRIZE_NICHE_FLOOR.y, topOf(middle)), STACK_COLOR)

    cycle = await startCycle({ bodies: SCENE, floor: [base, middle, top] })
    cycle.rolls.push(getGrabRolls(cycle).hit, SLIP_MISS, FUMBLE_MISS)

    expect(await cycle.playRound()).toEqual(DELIVERY)

    const stack = [...cycle.floorPile.getBodies()].filter(({ color }) => color === STACK_COLOR)

    expect(stack).toHaveLength(3)
    expect(Math.max(...stack.flatMap((body) => sectionOf(body).map(({ y }) => y)))).toBeLessThan(topOf(middle))
  })

  it('на промахе не берёт игрушку и едет к лотку пустой', async () => {
    cycle = await startCycle({ bodies: SCENE })
    cycle.rolls.push(getGrabRolls(cycle).miss)

    expect(await cycle.playRound()).toEqual(EMPTY_HANDED)
    expect(cycle.prizes).toEqual([])
    expect(cycle.floorPile.takeSnapshot()).toEqual([])
    expect(cycle.store.collected).toBe(0)
    expect(getShapes(cycle)).toEqual(['cube8', 'single', 'triangle'])
    expectSoundHeap(cycle.heap)
  })

  it('пустая клешня уходит от лотка только после полного разжатия', async () => {
    cycle = await startCycle({ bodies: SCENE })
    cycle.rolls.push(getGrabRolls(cycle).miss)
    await cycle.playRound()

    const { frames } = cycle
    const opened = frames.findIndex(({ phase, closed }) => phase === PhaseName.releasing && !closed)
    const left = frames.findIndex((frame, index) => index > opened && getDistance(frame.cart, frames[opened].cart) > 0)

    expect(isOverTray(frames[opened].cart)).toBe(true)
    expect((left - opened) * FRAME_MS).toBeGreaterThanOrEqual(CLAW_RELEASE_MS)
  })

  it('над пустым местом опускается пальцами до пола и не берёт ничего даже на удачном броске', async () => {
    cycle = await startCycle({ bodies: [triangle] })
    cycle.rolls.push(0)

    expect(await cycle.playRound()).toEqual(EMPTY_HANDED)
    expect(getGrabHeight(cycle)).toBe(CLAW_REACH)
    expect(cycle.store.collected).toBe(0)
  })

  it('роняет игрушку на подъёме обратно в кучу', async () => {
    cycle = await startCycle({ bodies: SCENE })
    cycle.rolls.push(getGrabRolls(cycle).hit, SLIP_HIT, 0.5)

    expect(await cycle.playRound()).toEqual(EMPTY_HANDED)
    expect(cycle.drops.map(({ phase }) => phase)).toEqual([PhaseName.ascending])
    expect(cycle.store.collected).toBe(0)
    expect(getShapes(cycle)).toEqual(['cube8', 'single', 'triangle'])
    expectSoundHeap(cycle.heap)
  })

  it('роняет игрушку по дороге над кубом, не останавливая клешню', async () => {
    cycle = await startCycle({ bodies: SCENE })
    // Последний бросок — самое раннее место потери: ровно на пороге от места захвата
    cycle.rolls.push(getGrabRolls(cycle).hit, SLIP_MISS, FUMBLE_HIT, 0)

    expect(await cycle.playRound()).toEqual(EMPTY_HANDED)

    const [drop] = cycle.drops
    const { frames } = cycle
    const released = frames.findIndex(({ phase, holding }) => phase === PhaseName.delivering && !holding)

    expect(cycle.drops).toHaveLength(1)
    expect(drop.phase).toBe(PhaseName.delivering)
    expect(getDistance(drop.cart, FIELD_CENTER)).toBeCloseTo(FUMBLE_START_CLEARANCE, 9)
    expect(isOverTray(drop.cart)).toBe(false)
    // Каретка едет дальше в том же ходе: потеря не тормозит её до нуля
    expect(frames[released + 1].phase).toBe(PhaseName.delivering)
    expect(getDistance(frames[released].cart, frames[released + 1].cart)).toBeGreaterThan(0)
    expect(cycle.store.collected).toBe(0)
    expect(getShapes(cycle)).toEqual(['cube8', 'single', 'triangle'])
  })

  it('опускает клешню под кареткой, куда её подвёл игрок', async () => {
    cycle = await startCycle({ bodies: SCENE })

    await cycle.moveCart({ x: triangle.slab + 0.5, y: triangle.y })
    cycle.rolls.push(getGrabRolls(cycle).hit, SLIP_MISS, FUMBLE_MISS)
    await cycle.playRound()

    expect(cycle.prizes).toEqual([{ shape: 'triangle', color: triangle.color, collected: 1 }])
    expect(getShapes(cycle)).toEqual(['cube8', 'single'])
  })

  it('выдаёт по очереди все игрушки, дошедшие до лотка за цикл', async () => {
    // Куб лежит на подушке у стенки лотка, мяч на кубе свешивается над шахтой: без куба мяч падает в лоток
    const pillow = stand('square4', 0, TRAY_ORIGIN.y - 1, 0)
    const base = paint(stand('cube8', 0, TRAY_ORIGIN.y - 1, topOf(pillow)), 0x3366ff)
    const rider = paint(stand('single', 1, TRAY_ORIGIN.y + 0.2, topOf(base)), 0xff3366)

    cycle = await startCycle({ bodies: [pillow, base, rider] })

    await cycle.moveCart({ x: 1, y: TRAY_ORIGIN.y - 1.6 })
    cycle.rolls.push(getGrabRolls(cycle).hit, SLIP_MISS, FUMBLE_MISS)

    expect(await cycle.playRound()).toEqual([
      PhaseName.descending,
      PhaseName.grabbing,
      PhaseName.ascending,
      PhaseName.delivering,
      PhaseName.releasing,
      PhaseName.presenting,
      PhaseName.presenting,
      PhaseName.returning,
      PhaseName.idle,
    ])
    expect(cycle.prizes).toEqual([
      { shape: 'single', color: rider.color, collected: 1 },
      { shape: 'cube8', color: base.color, collected: 2 },
    ])
    expect(cycle.store.collected).toBe(2)
    expect(getShapes(cycle)).toEqual(['square4'])
    expect(cycle.floorPile.takeSnapshot().map(({ color }) => color)).toEqual([rider.color, base.color])
  })

  it('игнорирует опускание посреди цикла и принимает следующее после покоя', async () => {
    cycle = await startCycle({ bodies: SCENE })
    cycle.rolls.push(getGrabRolls(cycle).miss)
    cycle.emitter.emit('ui:dropRequested')

    const current = cycle

    await current.runUntil(() => current.store.phase === PhaseName.grabbing)
    // Запрос в обход погашенной кнопки второй цикл не запускает
    current.emitter.emit('ui:dropRequested')
    await current.runUntil(() => current.store.isIdle)

    expect(current.phases.filter((phase) => phase === PhaseName.descending)).toHaveLength(1)

    current.rolls.push(getGrabRolls(current).miss)
    await current.playRound()

    expect(current.phases.filter((phase) => phase === PhaseName.descending)).toHaveLength(2)
  })

  it('проходит серию раундов по насыпанной куче: куча цела, на полу столько игрушек, сколько выдано призов', async () => {
    const random = createRandom(3)

    cycle = await startCycle({ bodies: getPouredHeap(7), random })

    for (let round = 0; round < 3; round++) {
      await cycle.moveCart({ x: 1 + random() * (GRID_SIZE - 2), y: 1 + random() * (GRID_SIZE - 2) })
      await cycle.playRound()

      expectSoundHeap(cycle.heap)
      expect(cycle.store.collected).toBe(cycle.prizes.length)
      expect(cycle.floorPile.takeSnapshot()).toHaveLength(cycle.prizes.length)
      expect(cycle.store.checkpoint?.bodies).toEqual(cycle.heap.takeSnapshot())
      expect(cycle.store.checkpoint?.floor).toEqual(cycle.floorPile.takeSnapshot())
    }
  })

  it('не оставляет подписок: в покое ждёт опускания и сброса по разу, после остановки — ни одной', async () => {
    cycle = await startCycle({ bodies: SCENE })
    cycle.rolls.push(getGrabRolls(cycle).miss)
    await cycle.playRound()

    const { emitter } = cycle

    expect(emitter.listenerCounts()).toMatchObject({ 'ui:dropRequested': 1, 'ui:resetRequested': 1 })

    await cycle.stop()
    cycle = undefined

    expect(emitter.listenerCounts()['ui:dropRequested'] ?? 0).toBe(0)
    expect(emitter.listenerCounts()['ui:resetRequested'] ?? 0).toBe(0)
  })
})
