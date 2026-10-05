// @vitest-environment jsdom
import { Assets, type Container, type FederatedPointerEvent, Texture } from 'pixi.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HUD_ATLAS, HUD_FRAMES, HUD_SEQUENCES } from '#src/assets'
import { ClawRig } from '#src/claw/claw-rig'
import { CONTROL_PANEL_PLANE, JOYSTICK_DEADZONE, JOYSTICK_RADIUS } from '#src/constants'
import { DropButtonController } from '#src/controllers/hud/drop-button'
import { JoystickController } from '#src/controllers/hud/joystick'
import { ResetButtonController } from '#src/controllers/hud/reset-button'
import { KeyboardController } from '#src/controllers/keyboard'
import type { GameEvents } from '#src/events'
import { Heap } from '#src/heap/heap'
import { ToyboxStore } from '#src/stores/toybox'
import { PhaseName, type ScreenPoint } from '#src/types'
import { DropButton } from '#src/ui/hud/drop-button'
import { Joystick } from '#src/ui/hud/joystick'
import { ResetButton } from '#src/ui/hud/reset-button'
import { ResetConfirm } from '#src/ui/hud/reset-confirm'
import { TourHint } from '#src/ui/hud/tour-hint'
import { projectPlaneOffset, worldToScreen } from '#src/utils/projection'
import { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import { KeyboardInput } from '@pixi-demos/core/keyboard-input'
import { GameTicker } from '@pixi-demos/engine/game-ticker'

import { getPouredHeap } from './setup/heap'

/** Шаг кадра при 60 fps. */
const FRAME_MS = 1000 / 60

/** Жест далеко за краем основания: ручка отклонена до упора. */
const FULL_TILT = 400

type Controls = {
  store: ToyboxStore
  heap: Heap
  emitter: GameEmitter<GameEvents>
  joystick: Joystick
  drop: DropButton
  reset: ResetButton
  dialog: ResetConfirm
  /** Стрелка над кнопкой сброса. */
  resetHint: TourHint
  requests: () => number
  /** Сколько раз сброс кучи ушёл наверх. */
  resets: () => number
  destroy: () => void
}

/** Кадры атласа органов управления: тест атласы не грузит. */
const HUD_TEXTURES = Object.values(HUD_FRAMES).flatMap((frame) =>
  typeof frame === 'string' ? [frame] : Object.values(frame)
)

/** Собирает управление в покое: клавиатуру, джойстик, кнопки Drop и сброса над одним стором и пустой кучей. */
const createControls = (): Controls => {
  const store = new ToyboxStore()
  const emitter = new GameEmitter<GameEvents>()
  const input = new KeyboardInput(window)
  const ticker = new GameTicker()
  const keyboard = new KeyboardController(input, store, emitter)
  const joystickController = new JoystickController(ticker, store)
  const dropController = new DropButtonController(ticker, store, emitter)
  const heap = new Heap()
  const resetController = new ResetButtonController(ticker, store, heap, input, emitter)
  const joystick = joystickController.children.find((child) => child instanceof Joystick) as Joystick
  const drop = dropController.children.find((child) => child instanceof DropButton) as DropButton
  const requested = vi.fn()
  const resetRequested = vi.fn()

  store.setPhase(PhaseName.idle)
  emitter.on('ui:dropRequested', requested)
  emitter.on('ui:resetRequested', resetRequested)

  return {
    store,
    heap,
    emitter,
    joystick,
    drop,
    reset: resetController.children.find((child) => child instanceof ResetButton) as ResetButton,
    dialog: resetController.children.find((child) => child instanceof ResetConfirm) as ResetConfirm,
    resetHint: resetController.children.find((child) => child instanceof TourHint) as TourHint,
    requests: () => requested.mock.calls.length,
    resets: () => resetRequested.mock.calls.length,
    destroy: () => {
      joystickController.destroy({ children: true })
      dropController.destroy({ children: true })
      resetController.destroy({ children: true })
      keyboard.destroy({ children: true })
      input.dispose()
    },
  }
}

/** Экранный путь каретки за 20 кадров хода по команде стора; каретка каждый раз выезжает из центра поля. */
const getCartShift = (store: ToyboxStore): ScreenPoint => {
  const rig = new ClawRig()
  const before = worldToScreen(rig.getCartPoint())

  for (let frame = 0; frame < 20; frame++) rig.advance(FRAME_MS, store.direction)

  const after = worldToScreen(rig.getCartPoint())

  return { x: after.x - before.x, y: after.y - before.y }
}

/** Каретка сдвинулась на экране в сторону `direction`. */
const expectShiftAlong = (shift: ScreenPoint, direction: ScreenPoint): void => {
  const lengths = Math.hypot(shift.x, shift.y) * Math.hypot(direction.x, direction.y)

  expect(lengths).toBeGreaterThan(0)
  expect((shift.x * direction.x + shift.y * direction.y) / lengths).toBeCloseTo(1, 9)
}

/** Нажимает на джойстик в точке `local` его основания. */
const tilt = (joystick: Joystick, local: ScreenPoint): void => {
  joystick.emit('pointerdown', { getLocalPosition: () => local } as unknown as FederatedPointerEvent)
}

/** Точка жеста на панели управления: отклонение ручки долей радиуса основания. */
const onPanel = (share: number): ScreenPoint => projectPlaneOffset(CONTROL_PANEL_PLANE, share * JOYSTICK_RADIUS, 0)

const press = (code: string, repeat = false): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, repeat }))
}

const release = (code: string): void => {
  window.dispatchEvent(new KeyboardEvent('keyup', { code }))
}

describe('управление', () => {
  let controls: Controls | undefined

  beforeEach(() => {
    for (const frame of HUD_TEXTURES) Assets.cache.set(frame, Texture.WHITE)
    Assets.cache.set(HUD_ATLAS, {
      animations: Object.fromEntries(
        Object.values(HUD_SEQUENCES).map((name) => [name, [Texture.WHITE, Texture.WHITE]])
      ),
    })
  })

  afterEach(() => {
    controls?.destroy()
    controls = undefined
    localStorage.clear()

    for (const frame of HUD_TEXTURES) Assets.cache.remove(frame)
    Assets.cache.remove(HUD_ATLAS)
  })

  it('ведёт каретку по экрану туда, куда тянут ручку джойстика', () => {
    controls = createControls()

    for (const direction of [
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: -1, y: 1 },
      { x: 0.3, y: -0.8 },
    ]) {
      tilt(controls.joystick, { x: direction.x * FULL_TILT, y: direction.y * FULL_TILT })

      expectShiftAlong(getCartShift(controls.store), direction)
    }
  })

  it('не двигает каретку в мёртвой зоне, а за ней ведёт на полной скорости при любом ходе ручки', () => {
    controls = createControls()

    tilt(controls.joystick, onPanel(JOYSTICK_DEADZONE / 2))

    expect(getCartShift(controls.store)).toEqual({ x: 0, y: 0 })

    tilt(controls.joystick, onPanel(JOYSTICK_DEADZONE * 2))

    const weak = getCartShift(controls.store)

    tilt(controls.joystick, onPanel(1))

    const full = getCartShift(controls.store)

    expect(weak.x).toBeCloseTo(full.x, 9)
    expect(weak.y).toBeCloseTo(full.y, 9)
  })

  it('ведёт каретку стрелками: сочетание — по диагонали, противоположные гасят друг друга', () => {
    controls = createControls()

    press('ArrowUp')

    expectShiftAlong(getCartShift(controls.store), { x: 0, y: -1 })

    press('ArrowLeft')

    expectShiftAlong(getCartShift(controls.store), { x: -1, y: -1 })

    press('ArrowRight')

    expectShiftAlong(getCartShift(controls.store), { x: 0, y: -1 })

    // Окно потеряло фокус: отпускания клавиш оно уже не услышит
    window.dispatchEvent(new Event('blur'))

    expect(getCartShift(controls.store)).toEqual({ x: 0, y: 0 })
  })

  it('слушает стрелки прежде джойстика, а после их отпускания снова ведёт каретку джойстиком', () => {
    controls = createControls()

    tilt(controls.joystick, { x: FULL_TILT, y: 0 })
    press('ArrowUp')

    expectShiftAlong(getCartShift(controls.store), { x: 0, y: -1 })

    release('ArrowUp')

    expectShiftAlong(getCartShift(controls.store), { x: 1, y: 0 })
  })

  it('запрашивает опускание по Enter и Space, но не по автоповтору клавиши', () => {
    controls = createControls()

    press('Enter')
    press('Enter', true)
    press('Space')

    expect(controls.requests()).toBe(2)
  })

  it('гасит управление вне покоя и отпускает ручку, зажатую на старте цикла', () => {
    controls = createControls()

    tilt(controls.joystick, { x: FULL_TILT, y: 0 })
    controls.store.setPhase(PhaseName.descending)
    press('Space')

    expect(getCartShift(controls.store)).toEqual({ x: 0, y: 0 })
    expect(controls.requests()).toBe(0)

    // В новом покое каретка сама не едет: ручку вернули в центр, пока управление было погашено
    controls.store.setPhase(PhaseName.idle)

    expect(getCartShift(controls.store)).toEqual({ x: 0, y: 0 })
  })

  it('показывает стрелки тура в покое до первого касания управления и не возвращает их после перезагрузки', () => {
    const touches: ((controls: Controls) => void)[] = [
      (current) => tilt(current.joystick, { x: FULL_TILT, y: 0 }),
      (current) => current.drop.emit('pointertap', {} as FederatedPointerEvent),
      () => press('ArrowLeft'),
    ]

    for (const touch of touches) {
      localStorage.clear()
      controls = createControls()

      expect(controls.store.isTourShown).toBe(true)

      touch(controls)

      expect(controls.store.isTourShown).toBe(false)

      // Перезагрузка страницы: новый стор читает флаг из localStorage
      const reloaded = new ToyboxStore()

      reloaded.setPhase(PhaseName.idle)

      expect(reloaded.isTourShown).toBe(false)

      controls.destroy()
      controls = undefined
    }
  })

  it('сбрасывает кучу только после подтверждения: крестик, Escape и повторное нажатие сброса отменяют диалог', () => {
    controls = createControls()

    const tap = (target: Container): void => {
      target.emit('pointertap', {} as FederatedPointerEvent)
    }
    const cancels: ((current: Controls) => void)[] = [
      (current) => tap(current.dialog.cancel),
      () => {
        press('Escape')
        release('Escape')
      },
      (current) => tap(current.reset),
    ]

    for (const cancel of cancels) {
      tap(controls.reset)

      // Открытый диалог гасит управление
      expect(controls.store.isResetConfirmOpen).toBe(true)
      expect(controls.store.canDrop).toBe(false)

      cancel(controls)

      expect(controls.store.isResetConfirmOpen).toBe(false)
      expect(controls.store.canDrop).toBe(true)
    }

    expect(controls.resets()).toBe(0)

    tap(controls.reset)
    tap(controls.dialog.confirm)

    expect(controls.resets()).toBe(1)
    expect(controls.store.isResetConfirmOpen).toBe(false)
  })

  it('подтверждает сброс отпусканием Enter, и тот же Enter не опускает клешню', () => {
    controls = createControls()
    controls.reset.emit('pointertap', {} as FederatedPointerEvent)
    press('Enter')

    expect(controls.resets()).toBe(0)

    release('Enter')

    expect(controls.resets()).toBe(1)
    expect(controls.requests()).toBe(0)
  })

  it('показывает стрелку к кнопке сброса, пока куча в кубе пуста и управление доступно', () => {
    controls = createControls()

    expect(controls.resetHint.visible).toBe(true)

    controls.reset.emit('pointertap', {} as FederatedPointerEvent)

    expect(controls.resetHint.visible).toBe(false)

    controls.store.closeResetConfirm()
    controls.heap.restore(getPouredHeap(7))
    controls.emitter.emit('heap:reset')

    expect(controls.resetHint.visible).toBe(false)
  })
})
