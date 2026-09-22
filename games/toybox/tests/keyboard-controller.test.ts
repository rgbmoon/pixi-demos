// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ClawController } from '#src/controllers/box/claw'
import { KeyboardController } from '#src/controllers/keyboard'
import type { GameEvents } from '#src/events'
import { ToyboxStore } from '#src/stores/toybox'
import { PhaseName } from '#src/types'
import { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import { KeyboardInput } from '@pixi-demos/core/keyboard-input'

describe('KeyboardController', () => {
  let keyboard: KeyboardInput | undefined
  let controller: KeyboardController | undefined

  afterEach(() => {
    controller?.destroy({ children: true })
    keyboard?.dispose()
    controller = undefined
    keyboard = undefined
    document.body.replaceChildren()
  })

  it('складывает совместимые стрелки и сокращает противоположные', () => {
    const directions: { x: number; y: number }[] = []
    const claw = { setDirection: (value: { x: number; y: number }) => directions.push(value) }
    const store = new ToyboxStore()

    store.setPhase(PhaseName.idle)
    keyboard = new KeyboardInput(window)
    controller = new KeyboardController(
      keyboard,
      claw as unknown as ClawController,
      store,
      new GameEmitter<GameEvents>()
    )

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }))

    expect(directions.at(-1)?.x).toBeCloseTo(-Math.SQRT1_2)
    expect(directions.at(-1)?.y).toBeCloseTo(-Math.SQRT1_2)

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))

    expect(directions.at(-1)).toEqual({ x: 0, y: -1 })

    window.dispatchEvent(new Event('blur'))

    expect(directions.at(-1)).toEqual({ x: 0, y: 0 })
  })

  it('отправляет Enter и Space отдельно, но игнорирует автоповтор', () => {
    const store = new ToyboxStore()
    const emitter = new GameEmitter<GameEvents>()
    const requested = vi.fn()

    store.setPhase(PhaseName.idle)
    emitter.on('ui:dropRequested', requested)
    keyboard = new KeyboardInput(window)
    controller = new KeyboardController(
      keyboard,
      { setDirection: vi.fn() } as unknown as ClawController,
      store,
      emitter
    )

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', repeat: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))

    expect(requested).toHaveBeenCalledTimes(2)
  })

  it('блокирует движение и Drop на время визуальной выдачи', () => {
    const store = new ToyboxStore()
    const emitter = new GameEmitter<GameEvents>()
    const setDirection = vi.fn()
    const requested = vi.fn()

    store.setPhase(PhaseName.idle)
    store.beginPrize()
    emitter.on('ui:dropRequested', requested)
    keyboard = new KeyboardInput(window)
    controller = new KeyboardController(
      keyboard,
      { setDirection } as unknown as ClawController,
      store,
      emitter
    )

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))

    expect(setDirection).toHaveBeenLastCalledWith({ x: 0, y: 0 })
    expect(requested).not.toHaveBeenCalled()
  })
})
