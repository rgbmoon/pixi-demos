// @vitest-environment jsdom
import type { FederatedPointerEvent } from 'pixi.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ClawRig } from '#src/claw/claw-rig'
import { CONTROL_PANEL_PLANE, JOYSTICK_DEADZONE, JOYSTICK_RADIUS } from '#src/constants'
import { JoystickController } from '#src/controllers/hud/joystick'
import { KeyboardController } from '#src/controllers/keyboard'
import type { GameEvents } from '#src/events'
import { ToyboxStore } from '#src/stores/toybox'
import { PhaseName, type ScreenPoint } from '#src/types'
import { Joystick } from '#src/ui/hud/joystick'
import { projectPlaneOffset, worldToScreen } from '#src/utils/projection'
import { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import { KeyboardInput } from '@pixi-demos/core/keyboard-input'

/** Шаг кадра при 60 fps. */
const FRAME_MS = 1000 / 60

/** Жест далеко за краем основания: ручка отклонена до упора. */
const FULL_TILT = 400

type Controls = {
  store: ToyboxStore
  joystick: Joystick
  requests: () => number
  destroy: () => void
}

/** Собирает управление в покое: клавиатуру и джойстик над одним стором. */
const createControls = (): Controls => {
  const store = new ToyboxStore()
  const emitter = new GameEmitter<GameEvents>()
  const input = new KeyboardInput(window)
  const keyboard = new KeyboardController(input, store, emitter)
  const joystickController = new JoystickController(store)
  const joystick = joystickController.children.find((child) => child instanceof Joystick) as Joystick
  const requested = vi.fn()

  store.setPhase(PhaseName.idle)
  emitter.on('ui:dropRequested', requested)

  return {
    store,
    joystick,
    requests: () => requested.mock.calls.length,
    destroy: () => {
      joystickController.destroy({ children: true })
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

  afterEach(() => {
    controls?.destroy()
    controls = undefined
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
})
