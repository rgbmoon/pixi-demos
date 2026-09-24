// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

import {
  CLAW_GRAB_MS,
  FIELD_CENTER,
  HEAP_SNAPSHOT_VERSION,
  SHAPE_KEYS,
  TOY_ANGLE_STEP,
  TRAY_CENTER,
  TRAY_EXIT_Z,
} from '#src/constants'
import { ClawController } from '#src/controllers/box/claw'
import { ContentsController } from '#src/controllers/box/contents'
import { PersistenceController } from '#src/controllers/persistence'
import type { GameEvents } from '#src/events'
import { IdlePhase } from '#src/phases/idle'
import { HeapStore } from '#src/stores/heap'
import { ToyboxStore } from '#src/stores/toybox'
import { type HeapSnapshot, type HeapSnapshotBody, PhaseName, type ShapeKey, type ToyBody } from '#src/types'
import { Toy } from '#src/ui/box/toy'
import { ToyShapes } from '#src/ui/box/toy-shapes'
import { getShapeOutline } from '#src/ui/box/utils'
import { getCabinetOutlines } from '#src/utils/machine-geometry'
import { worldToScreen } from '#src/utils/projection'
import { getSection, getVariantCount } from '#src/utils/shapes'
import { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { IdbStorage } from '@pixi-demos/core/idb-storage'
import { GameTicker } from '@pixi-demos/engine/game-ticker'

const snapshot = (bodies: HeapSnapshotBody[]): HeapSnapshot => ({ version: HEAP_SNAPSHOT_VERSION, collected: 0, bodies })

/** Игрушка снимка, стоящая без крена на полу. */
const standing = (shape: ShapeKey, slab: number, y: number): HeapSnapshotBody => ({
  shape,
  variant: 0,
  slab,
  y,
  z: 0.001 - Math.min(...getSection(shape, 0).map(({ z }) => z)),
  angle: 0,
  color: 0xff8800,
})

/** Число шагов крена, с которым силуэт проверяется на скрытие корпусом. */
const HIDDEN_ANGLE_STEPS = 24

describe('регрессии модели и геометрии', () => {
  it('ставит игрушку в проекцию позы и не меняет её масштаб', () => {
    const shapes = new ToyShapes()
    for (const shape of SHAPE_KEYS) {
      const toy = new Toy(shapes, shape, 0, 0xffffff)
      for (const point of [{ x: 0.3, y: 1.7, z: 5.2 }, { x: 5, y: 4, z: 1 }, { ...TRAY_CENTER, z: TRAY_EXIT_Z }]) {
        toy.setPose(point, 0.4)
        expect({ x: toy.x, y: toy.y }).toEqual(worldToScreen(point))
        expect(toy.scale.x).toBe(1)
        expect(toy.scale.y).toBe(1)
      }
      toy.destroy({ children: true })
    }
    shapes.destroy()
  })

  it('скрывает силуэт каждой формы на высоте ухода из шахты корпусом с обводкой и запасом при любом крене', () => {
    const faces = getCabinetOutlines().map((face) => face.map((point) => worldToScreen(point)))
    const origin = worldToScreen({ ...TRAY_CENTER, z: TRAY_EXIT_Z })
    const inside = (x: number, y: number) => faces.some((face) => {
      let hit = false
      for (let i = 0, j = face.length - 1; i < face.length; j = i, i += 1) {
        const a = face[i], b = face[j]
        if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) hit = !hit
      }
      return hit
    })
    const stepsPerTurn = Math.round((2 * Math.PI) / TOY_ANGLE_STEP)
    for (const shape of SHAPE_KEYS) for (let variant = 0; variant < getVariantCount(shape); variant++) {
      for (let turn = 0; turn < HIDDEN_ANGLE_STEPS; turn++) {
        const outline = getShapeOutline(shape, variant, Math.round((turn * stepsPerTurn) / HIDDEN_ANGLE_STEPS))
        for (let i = 0; i < outline.length; i++) for (const t of [0, 0.5]) {
          const a = outline[i], b = outline[(i + 1) % outline.length]
          for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
            expect(inside(origin.x + a.x + (b.x - a.x) * t + 6 * Math.cos(angle),
              origin.y + a.y + (b.y - a.y) * t + 6 * Math.sin(angle))).toBe(true)
          }
        }
      }
    }
  })
})

describe('регрессии контроллеров и жизненного цикла', () => {
  it('ведёт игрушку в том же кадре, что клешню, и доставляет её центр точно над лотком', async () => {
    const ticker = new GameTicker()
    const store = new ToyboxStore()
    const heap = new HeapStore()
    const claw = new ClawController(ticker, store)
    const contents = new ContentsController(ticker, heap, store, claw)
    heap.restore(snapshot([standing('cube8', 3, FIELD_CENTER.y)]), () => 0.99)
    const body = heap.getTopBodyAt(FIELD_CENTER) as Readonly<ToyBody>
    const initial = { ...body.pose.point }
    const grip = claw.getGripPoint()
    heap.lift(FIELD_CENTER, grip)
    let time = 0
    ticker.update(time)
    const grab = claw.grab((progress, point) => heap.setGrabProgress(progress, point), new AbortController().signal)
    // PIXI ограничивает deltaMS до 100 мс, поэтому захват продвигаем несколькими кадрами.
    for (let elapsed = 0; elapsed < CLAW_GRAB_MS; elapsed += 100) {
      time += Math.min(100, CLAW_GRAB_MS - elapsed)
      ticker.update(time)
    }
    await grab
    const move = claw.carryTo(TRAY_CENTER, undefined)
    for (let frame = 0; frame < 35; frame++) {
      time += 100
      ticker.update(time)
      await Promise.resolve()
      const current = claw.getGripPoint()
      expect(body.pose.point.x).toBeCloseTo(current.x, 12)
      expect(body.pose.point.y).toBeCloseTo(current.y, 12)
      expect(body.pose.point.z).toBeCloseTo(current.z + initial.z - grip.z, 12)
    }
    await move
    expect(body.pose.point.x).toBeCloseTo(TRAY_CENTER.x, 12)
    expect(body.pose.point.y).toBeCloseTo(TRAY_CENTER.y, 12)
    contents.destroy({ children: true })
    contents.destroy({ children: true })
    ticker.destroy()
  })

  it('оставляет одну подписку Reset после нескольких входов в idle', async () => {
    const store = new ToyboxStore()
    const heap = new HeapStore()
    const emitter = new GameEmitter<GameEvents>()
    const phase = new IdlePhase(emitter, heap, store)
    const abort = new AbortController()
    const reset = vi.spyOn(heap, 'restore')
    store.setPhase(PhaseName.idle)
    for (let round = 0; round < 3; round++) {
      const pending = phase.enter(abort.signal)
      expect(emitter.listenerCounts()['ui:resetRequested']).toBe(1)
      emitter.emit('ui:resetRequested')
      expect(reset).toHaveBeenCalledTimes(round + 1)
      emitter.emit('ui:dropRequested')
      await pending
      expect(emitter.listenerCounts()['ui:resetRequested'] ?? 0).toBe(0)
    }
    abort.abort()
  })

  it('при уходе посреди цикла сохраняет прежний снимок без потери соседа', () => {
    const store = new ToyboxStore()
    const heap = new HeapStore()
    heap.restore(snapshot([standing('bar2', 3, 3), standing('single', 3, 5)]), () => 0.99)
    const checkpoint = heap.takeSnapshot(0)
    const write = vi.fn(async () => { })
    store.publishCheckpoint(checkpoint)
    const persistence = new PersistenceController(store, { write } as unknown as IdbStorage<HeapSnapshot>)
    const point = { x: 3.5, y: 3 }
    heap.lift(point, { ...point, z: heap.getSurfaceHeightAt(point) })
    for (let frame = 0; frame < 60; frame++) heap.advance(1000 / 60)
    window.dispatchEvent(new Event('pagehide'))
    expect(write).toHaveBeenLastCalledWith(checkpoint)
    const restored = new HeapStore()
    restored.restore(checkpoint, () => 0.99)
    expect([...restored.getBodies()]).toHaveLength(2)
    persistence.destroy()
  })

  it('возвращает команду джойстика после отпускания клавиатуры и блокирует оба источника вне idle', () => {
    const store = new ToyboxStore()
    store.setPhase(PhaseName.idle)
    store.setJoystickDirection({ x: 0.4, y: 0 })
    const joystick = store.direction
    store.setKeyboardDirection({ x: 0, y: -1 })
    expect(store.direction).not.toEqual(joystick)
    store.setKeyboardDirection({ x: 0, y: 0 })
    expect(store.direction).toEqual(joystick)
    store.setPhase(PhaseName.presenting)
    expect(store.direction).toEqual({ x: 0, y: 0 })
  })
})

it.each([false, true])('выполняет срыв на участке маршрута каретки из текущего захвата, reduced motion: %s', async (reduced) => {
  const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: reduced } as MediaQueryList)
  const ticker = new GameTicker()
  const store = new ToyboxStore()
  const claw = new ClawController(ticker, store)
  const from = claw.getCartPoint()
  const target = { x: 1, y: 7 }
  const share = 0.31
  const dropped = vi.fn()
  const abort = new AbortController()
  const add = vi.spyOn(abort.signal, 'addEventListener')
  const remove = vi.spyOn(abort.signal, 'removeEventListener')
  const pending = claw.carryTo(target, {
    share,
    onDrop: (grip) => dropped({ grip, currentGrip: claw.getGripPoint(), cart: claw.getCartPoint() }),
  }, abort.signal)
  let time = 0
  ticker.update(time)
  for (let i = 0; i < 30; i++) { time += 100; ticker.update(time) }
  await pending

  expect(dropped).toHaveBeenCalledTimes(1)
  const { grip, currentGrip, cart } = dropped.mock.calls[0][0]
  expect(grip).toEqual(currentGrip)
  expect(cart.x).toBeCloseTo(from.x + (target.x - from.x) * share, 12)
  expect(cart.y).toBeCloseTo(from.y + (target.y - from.y) * share, 12)
  expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0][1])
  claw.destroy({ children: true })
  ticker.destroy()
  media.mockRestore()
})

it('отменяет предыдущее движение без оставшегося обработчика abort', async () => {
  const ticker = new GameTicker()
  const store = new ToyboxStore()
  const claw = new ClawController(ticker, store)
  const abort = new AbortController()
  const add = vi.spyOn(abort.signal, 'addEventListener')
  const remove = vi.spyOn(abort.signal, 'removeEventListener')
  const first = claw.moveTo({ x: 1, y: 7 }, abort.signal)
  const firstResult = expect(first).rejects.toMatchObject({ name: 'AbortError' })
  const second = claw.moveTo({ x: 5, y: 4 }, abort.signal)
  const secondResult = expect(second).rejects.toMatchObject({ name: 'AbortError' })
  await firstResult
  abort.abort()
  await secondResult
  expect(remove.mock.calls.map((call) => call[1])).toEqual(add.mock.calls.map((call) => call[1]))
  claw.destroy({ children: true })
  ticker.destroy()
})
