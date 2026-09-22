// @vitest-environment jsdom
import type { Ticker } from 'pixi.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  PRIZE_DOOR_MS,
  PRIZE_OPEN_HOLD_MS,
  PRIZE_PAUSE_MS,
  PRIZE_TAKE_MS,
} from '#src/constants'
import { PrizeOutputController } from '#src/controllers/box/prize-output'
import type { GameEvents } from '#src/events'
import { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'

describe('PrizeOutputController', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('проигрывает точный порядок выдачи и не смешивает элементы очереди', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)

    const log: string[] = []
    const waits: Array<() => void> = []
    let frame: ((ticker: Ticker) => void) | undefined
    const ticker = {
      waitTicks: (durationMs: number) =>
        new Promise<void>((resolve) => {
          log.push(`wait:${durationMs}`)
          waits.push(resolve)
        }),
      add: (callback: (value: Ticker) => void) => {
        frame = callback
        log.push('tween')
      },
      remove: (callback: (value: Ticker) => void) => {
        if (frame === callback) frame = undefined
      },
    } as unknown as GameTicker
    const emitter = new GameEmitter<GameEvents>()
    const controller = new PrizeOutputController(ticker, emitter)
    const flush = async () => {
      await Promise.resolve()
      await Promise.resolve()
    }
    const advance = async (durationMs: number) => {
      const active = frame

      expect(active).toBeDefined()
      active?.({ deltaMS: durationMs } as Ticker)
      await flush()
    }

    emitter.on('prize:taken', ({ collected }) => log.push(`taken:${collected}`))

    const first = controller.present({ shape: 'single', color: 0xff0000 }, 1)
    const second = controller.present({ shape: 'bar2', color: 0x00ff00 }, 2)

    expect(log).toEqual([`wait:${PRIZE_PAUSE_MS}`])

    waits.shift()?.()
    await flush()
    await advance(PRIZE_DOOR_MS)

    expect(log).toEqual([`wait:${PRIZE_PAUSE_MS}`, 'tween', `wait:${PRIZE_OPEN_HOLD_MS}`])

    waits.shift()?.()
    await flush()
    await advance(PRIZE_TAKE_MS)

    expect(log.at(-2)).toBe('taken:1')
    expect(log.at(-1)).toBe('tween')

    await advance(PRIZE_DOOR_MS)
    await first
    await flush()

    expect(log.at(-1)).toBe(`wait:${PRIZE_PAUSE_MS}`)

    waits.shift()?.()
    await flush()
    await advance(PRIZE_DOOR_MS)
    waits.shift()?.()
    await flush()
    await advance(PRIZE_TAKE_MS)
    await advance(PRIZE_DOOR_MS)
    await second

    expect(log.filter((item) => item.startsWith('taken:'))).toEqual(['taken:1', 'taken:2'])

    controller.destroy({ children: true })
  })
})
