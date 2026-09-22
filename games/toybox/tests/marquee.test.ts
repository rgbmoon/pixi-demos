// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { RESET_MS, WELCOME_MS } from '#src/constants'
import { MarqueeController } from '#src/controllers/box/marquee'
import type { GameEvents } from '#src/events'
import { ToyboxStore } from '#src/stores/toybox'
import { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'

describe('MarqueeController', () => {
  it('показывает WELCOME и RESET на заданное время, затем возвращает счёт', async () => {
    const waits: Array<{ readonly durationMs: number; readonly resolve: () => void }> = []
    const ticker = {
      waitTicks: (durationMs: number) =>
        new Promise<void>((resolve) => {
          waits.push({ durationMs, resolve })
        }),
    } as unknown as GameTicker
    const store = new ToyboxStore()
    const emitter = new GameEmitter<GameEvents>()
    const marquee = new MarqueeController(ticker, store, emitter)

    store.applyCollected(3)
    emitter.emit('game:booted')

    expect(marquee.getMessage()).toBe('WELCOME')
    expect(waits[0]?.durationMs).toBe(WELCOME_MS)

    waits.shift()?.resolve()
    await Promise.resolve()

    expect(marquee.getMessage()).toBe('TOYS 3')

    store.applyCollected(0)
    emitter.emit('heap:reset')

    expect(marquee.getMessage()).toBe('RESET')
    expect(waits[0]?.durationMs).toBe(RESET_MS)

    waits.shift()?.resolve()
    await Promise.resolve()

    expect(marquee.getMessage()).toBe('TOYS 0')

    emitter.emit('prize:taken', { collected: 1 })

    expect(marquee.getMessage()).toBe('TOYS 1')

    marquee.destroy({ children: true })
  })
})
