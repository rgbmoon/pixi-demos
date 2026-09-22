// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { KeyboardInput } from '#src/keyboard-input'

describe('KeyboardInput', () => {
  let keyboard: KeyboardInput | undefined

  afterEach(() => {
    keyboard?.dispose()
    keyboard = undefined
    document.body.replaceChildren()
  })

  it('хранит физические коды, сообщает повтор и очищает на отпускании', () => {
    keyboard = new KeyboardInput(window)

    const listener = vi.fn()

    keyboard.listen(['ArrowLeft'], listener, { preventDefault: true })

    const down = new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true, cancelable: true })

    window.dispatchEvent(down)

    expect(down.defaultPrevented).toBe(true)
    expect(keyboard.isPressed('ArrowLeft')).toBe(true)
    expect(listener).toHaveBeenLastCalledWith({ code: 'ArrowLeft', pressed: true, repeat: false })

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', repeat: true }))

    expect(listener).toHaveBeenLastCalledWith({ code: 'ArrowLeft', pressed: true, repeat: true })

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft' }))

    expect(keyboard.isPressed('ArrowLeft')).toBe(false)
    expect(listener).toHaveBeenLastCalledWith({ code: 'ArrowLeft', pressed: false, repeat: false })
  })

  it('снимает все нажатия при потере фокуса окна', () => {
    keyboard = new KeyboardInput(window)

    const listener = vi.fn()

    keyboard.listen(['ArrowLeft', 'ArrowUp'], listener)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }))
    window.dispatchEvent(new Event('blur'))

    expect(keyboard.isPressed('ArrowLeft')).toBe(false)
    expect(keyboard.isPressed('ArrowUp')).toBe(false)
    expect(listener).toHaveBeenCalledWith({ code: 'ArrowLeft', pressed: false, repeat: false })
    expect(listener).toHaveBeenCalledWith({ code: 'ArrowUp', pressed: false, repeat: false })
  })

  it('не перехватывает ввод сфокусированного HTML-контрола', () => {
    keyboard = new KeyboardInput(window)

    const listener = vi.fn()
    const input = document.createElement('input')

    document.body.appendChild(input)
    keyboard.listen(['Space'], listener, { preventDefault: true })

    const event = new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true })

    input.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(keyboard.isPressed('Space')).toBe(false)
    expect(listener).not.toHaveBeenCalled()
  })

  it('снимает DOM-подписки при уничтожении', () => {
    keyboard = new KeyboardInput(window)

    const listener = vi.fn()

    keyboard.listen(['Enter'], listener)
    keyboard.dispose()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }))

    expect(listener).not.toHaveBeenCalled()
    keyboard = undefined
  })
})
