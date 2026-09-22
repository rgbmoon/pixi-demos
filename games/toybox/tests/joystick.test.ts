// @vitest-environment jsdom
import { Circle, type FederatedPointerEvent } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'

import { BUTTON_SIZE_UNITS, JOYSTICK_DEADZONE, JOYSTICK_HIT_RADIUS, JOYSTICK_RADIUS } from '#src/constants'
import { Joystick } from '#src/ui/hud/joystick'

describe('Joystick', () => {
  it('имеет размер Drop и крупную круглую область захвата', () => {
    const joystick = new Joystick({ onMove: vi.fn() })

    expect(JOYSTICK_RADIUS * 2).toBe(BUTTON_SIZE_UNITS)
    expect(joystick.hitArea).toBeInstanceOf(Circle)
    expect((joystick.hitArea as Circle).radius).toBe(JOYSTICK_HIT_RADIUS)

    joystick.destroy({ children: true })
  })

  it('преобразует движение мыши в ненулевое экранное направление', () => {
    const onMove = vi.fn()
    const joystick = new Joystick({ onMove })
    const event = {
      getLocalPosition: () => ({ x: 32, y: -16 }),
    } as unknown as FederatedPointerEvent

    joystick.emit('pointerdown', event)

    expect(onMove).toHaveBeenCalledOnce()
    const vector = onMove.mock.lastCall?.[0] as { x: number; y: number }

    expect(Math.hypot(vector.x, vector.y)).toBeGreaterThan(JOYSTICK_DEADZONE)

    joystick.emit('pointerup', event)
    expect(onMove).toHaveBeenLastCalledWith({ x: 0, y: 0 })

    joystick.destroy({ children: true })
  })
})
