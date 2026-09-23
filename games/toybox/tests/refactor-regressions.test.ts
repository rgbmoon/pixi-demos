// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

import { CLAW_GRAB_MS, FACINGS, GRID_SIZE, HEAP_SNAPSHOT_VERSION, MAX_LAYERS, SHAPE_KEYS, TRAY_CENTER, TRAY_EXIT_Z } from '#src/constants'
import { ClawController } from '#src/controllers/box/claw'
import { ContentsController } from '#src/controllers/box/contents'
import { PersistenceController } from '#src/controllers/persistence'
import type { GameEvents } from '#src/events'
import { IdlePhase } from '#src/phases/idle'
import { HeapStore } from '#src/stores/heap'
import { ToyboxStore } from '#src/stores/toybox'
import { type HeapSnapshot, PhaseName, ToyState } from '#src/types'
import { Toy } from '#src/ui/box/toy'
import { ToyShapes } from '#src/ui/box/toy-shapes'
import { getShapeOutline } from '#src/ui/box/utils'
import { getCabinetOutlines, projectWorldOutline } from '#src/utils/machine-geometry'
import { getDepthOrder, getPathIntervals, isTrayCell, worldToScreen } from '#src/utils/projection'
import { getPlacementCells, getShapeCells, getShapeCenter } from '#src/utils/shapes'
import { isHeapSnapshot } from '#src/utils/snapshot'
import { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { IdbStorage } from '@pixi-demos/core/idb-storage'
import { GameTicker } from '@pixi-demos/engine/game-ticker'
import { getCanvasSize } from '@pixi-demos/engine/utils'

const snapshot = (bodies: HeapSnapshot['bodies']): HeapSnapshot => ({ version: HEAP_SNAPSHOT_VERSION, collected: 0, bodies })
const single = { shape: 'single', facing: 0, anchor: { col: 3, row: 3 }, layer: 0, color: 0xff8800 } as const

const settle = (heap: HeapStore) => {
  for (let frame = 0; frame < 1000; frame++) {
    heap.advance(1000 / 60)
    if (heap.settled) return
  }
  throw new Error('Heap did not settle')
}

describe('регрессии модели и геометрии', () => {
  it('сохраняет видимую позицию при захвате любой формы и ориентации, включая просадку', () => {
    for (const shape of SHAPE_KEYS) for (const facing of FACINGS) {
      const heap = new HeapStore()
      const cell = { col: 3, row: 3 }
      heap.restore(snapshot([{ ...single, shape, facing }]), () => 0.99)
      heap.setPressed(cell)
      heap.advance(100)
      const body = heap.getTopBody(cell)!
      const visible = { ...body.pose.point, z: body.pose.point.z + body.bounce.value }
      const grip = { x: 3.5, y: 3.5, z: heap.getSurfaceHeight(cell) }

      heap.lift(cell, grip)
      heap.setPressed(undefined)
      heap.setGripPoint(grip)
      heap.advance(16)

      expect(body.pose.point).toEqual(visible)
      expect(body.bounce.value).toBe(0)
      heap.setGripPoint({ x: grip.x + 1, y: grip.y - 1, z: grip.z + 2 })
      expect(body.pose.point).toEqual({ x: visible.x + 1, y: visible.y - 1, z: visible.z + 2 })
    }
  })

  it('отменяет срыв при отсутствии доступного места и сохраняет игрушку в захвате', () => {
    const bodies: HeapSnapshot['bodies'] = [
      { ...single, shape: 'bar2' },
      { ...single, shape: 'cube8', anchor: { col: 2, row: 2 }, layer: 1 },
    ]
    const occupied = new Set(bodies.flatMap((body) => getPlacementCells(body.shape, body.facing, body.anchor, body.layer))
      .map(({ col, row, layer }) => `${col}:${row}:${layer}`))
    for (let col = 0; col < GRID_SIZE; col++) for (let row = 0; row < GRID_SIZE; row++) {
      for (let layer = 0; layer < MAX_LAYERS; layer++) {
        if (isTrayCell({ col, row }) || occupied.has(`${col}:${row}:${layer}`) || (col === 4 && row === 3)) continue
        bodies.push({ ...single, anchor: { col, row }, layer })
      }
    }
    const heap = new HeapStore()
    heap.restore(snapshot(bodies), () => 0.99)
    const grip = { x: 4.5, y: 3.5, z: 1 }
    const id = heap.lift({ col: 4, row: 3 }, grip)

    expect(id).toBeDefined()
    expect(heap.release(grip)).toBe(false)
    expect(heap.isHolding).toBe(true)
    expect(heap.releaseOutcome.status).toBe('none')
    expect([...heap.getBodies()].find((body) => body.id === id)?.state).toBe(ToyState.carried)
  })

  it('меняет отображаемую ориентацию только при посадке', () => {
    const heap = new HeapStore()
    heap.restore(snapshot([{ ...single, shape: 'bar2' }]), () => 0.99)
    heap.lift(single.anchor, { x: 3.5, y: 3.5, z: 1 })
    heap.release({ x: 5.5, y: 5.5, z: 6 })
    const body = [...heap.getBodies()][0]
    expect(body.placement.facing).toBe(1)
    expect(body.pose.facing).toBe(0)
    heap.advance(body.durationMs / 2)
    expect(body.pose.facing).toBe(0)
    settle(heap)
    expect(body.pose.facing).toBe(1)
  })

  it('не пропускает короткое пересечение ячейки и выбирает точки внутри интервалов', () => {
    const from = { x: 2.095, y: 1.322 }
    const to = { x: 1, y: 7 }
    const intervals = getPathIntervals(from, to)
    expect(intervals.map(({ cell }) => cell)).toContainEqual({ col: 1, row: 1 })
    for (const { cell, enter, exit } of intervals) {
      const t = (enter + exit) / 2
      expect(Math.floor(from.x + (to.x - from.x) * t)).toBe(cell.col)
      expect(Math.floor(from.y + (to.y - from.y) * t)).toBe(cell.row)
    }
  })

  it('сортирует каждую текущую позу по ближайшей клетке без изменения масштаба', () => {
    const shapes = new ToyShapes()
    for (const shape of SHAPE_KEYS) for (const facing of FACINGS) {
      const toy = new Toy(shapes, shape, facing, 0xffffff)
      const center = getShapeCenter(shape, facing)
      for (const point of [{ x: 0.3, y: 1.7, z: 5.2 }, { x: 5, y: 4, z: 1 }, { ...TRAY_CENTER, z: TRAY_EXIT_Z }]) {
        const bounce = -0.13
        toy.setWorld(point, bounce)
        const expected = Math.max(...getShapeCells(shape, facing).map(({ dx, dy, dz }) =>
          getDepthOrder({ x: point.x + dx - center.dx, y: point.y + dy - center.dy, z: point.z + bounce + dz - center.dz })))
        expect(toy.zIndex).toBeCloseTo(expected, 12)
        expect({ x: toy.x, y: toy.y }).toEqual(worldToScreen({ ...point, z: point.z + bounce }))
        expect(toy.scale.x).toBe(1)
        expect(toy.scale.y).toBe(1)
      }
      toy.destroy({ children: true })
    }
    shapes.destroy()
  })

  it('скрывает конечный контур каждой формы корпусом с обводкой и запасом', () => {
    const faces = getCabinetOutlines().map(projectWorldOutline)
    const origin = worldToScreen({ ...TRAY_CENTER, z: TRAY_EXIT_Z })
    const inside = (x: number, y: number) => faces.some((face) => {
      let hit = false
      for (let i = 0, j = face.length - 1; i < face.length; j = i, i += 1) {
        const a = face[i], b = face[j]
        if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) hit = !hit
      }
      return hit
    })
    for (const shape of SHAPE_KEYS) for (const facing of FACINGS) {
      const outline = getShapeOutline(shape, facing)
      for (let i = 0; i < outline.length; i++) for (let t = 0; t <= 1; t += 0.1) {
        const a = outline[i], b = outline[(i + 1) % outline.length]
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
          expect(inside(origin.x + a.x + (b.x - a.x) * t + 6 * Math.cos(angle),
            origin.y + a.y + (b.y - a.y) * t + 6 * Math.sin(angle))).toBe(true)
        }
      }
    }
  })

  it.each([0.5, NaN, Infinity, -1, 8])('отвергает недопустимую координату %s до изменения модели', (col) => {
    const invalid = snapshot([{ ...single, anchor: { col, row: 3 } }])
    expect(isHeapSnapshot(invalid)).toBe(false)
    const heap = new HeapStore()
    heap.restore(snapshot([single]), () => 0.99)
    const before = heap.takeSnapshot(0)
    expect(() => heap.restore(invalid, () => 0.99)).toThrow('Invalid heap snapshot')
    expect(heap.takeSnapshot(0)).toEqual(before)
  })

  it('отвергает унаследованное имя формы, дробную ориентацию и пересечения', () => {
    expect(isHeapSnapshot(snapshot([{ ...single, shape: 'toString' } as never]))).toBe(false)
    expect(isHeapSnapshot(snapshot([{ ...single, facing: 0.5 } as never]))).toBe(false)
    expect(isHeapSnapshot(snapshot([single, single]))).toBe(false)
  })

  it('вписывает фиксированный канвас одним масштабом, сохраняя обычную мобильную ветку', () => {
    for (const [width, height] of [[390, 780], [768, 960], [1280, 936], [844, 326]]) {
      const size = getCanvasSize(width, height, { aspectRatio: 9 / 16, fillMaxWidth: 640, designSize: { width: 1152, height: 2048 } })
      expect(size.width / 1152).toBeCloseTo(size.height / 2048, 14)
      expect(size.width).toBeLessThanOrEqual(width)
      expect(size.height).toBeLessThanOrEqual(height)
    }
    expect(getCanvasSize(390, 780, { aspectRatio: 9 / 16, fillMaxWidth: 640 })).toEqual({ width: 390, height: 780 })
  })
})

describe('регрессии контроллеров и жизненного цикла', () => {
  it('ведёт игрушку в том же кадре, что клешню, и доставляет её центр точно над лотком', async () => {
    const ticker = new GameTicker()
    const store = new ToyboxStore()
    const heap = new HeapStore()
    const claw = new ClawController(ticker, store)
    const contents = new ContentsController(ticker, heap, store, claw)
    heap.restore(snapshot([{ ...single, shape: 'cube8' }]), () => 0.99)
    const body = heap.getTopBody(single.anchor)!
    const initial = { ...body.pose.point }
    const grip = claw.getGripPoint()
    heap.lift(single.anchor, grip)
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
    heap.restore(snapshot([
      { ...single, shape: 'bar2' },
      { ...single, anchor: { col: 4, row: 3 }, layer: 1 },
    ]), () => 0.99)
    const checkpoint = heap.takeSnapshot(0)
    const write = vi.fn(async () => { })
    store.publishCheckpoint(checkpoint)
    const persistence = new PersistenceController(store, { write } as unknown as IdbStorage<HeapSnapshot>)
    heap.lift({ col: 3, row: 3 }, { x: 3.5, y: 3.5, z: 1 })
    settle(heap)
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
