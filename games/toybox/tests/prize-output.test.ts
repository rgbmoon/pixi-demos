// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

import { PRIZE_DOOR_MS, PRIZE_OPEN_HOLD_MS, PRIZE_PAUSE_MS, PRIZE_TAKE_MS } from '#src/constants'
import { PrizeOutputController } from '#src/controllers/box/prize-output'
import type { GameEvents } from '#src/events'
import { PresentingPhase } from '#src/phases/presenting'
import type { HeapStore } from '#src/stores/heap'
import { PhaseName } from '#src/types'
import { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import { GameTicker } from '@pixi-demos/engine/game-ticker'

describe('выдача одного приза', () => {
  it('фаза соблюдает порядок операций и объявляет получение до закрытия дверцы', async () => {
    const ticker = new GameTicker()
    const output = new PrizeOutputController(ticker)
    const heap = { releaseOutcome: { status: 'collected', appearance: { shape: 'bar2', color: 0xff0000 } } } as unknown as HeapStore
    const emitter = new GameEmitter<GameEvents>()
    const taken = vi.fn()
    const {signal} = new AbortController()
    const phase = new PresentingPhase(ticker, output, heap, emitter)
    const log: string[] = []

    for (const method of ['show', 'open', 'take', 'close', 'hide'] as const) {
      const original = output[method].bind(output)

      vi.spyOn(output, method).mockImplementation((...args: never[]) => {
        log.push(method)
        return (original as (...values: never[]) => void)(...args)
      })
    }
    emitter.on('prize:taken', () => { log.push('taken'); taken() })
    const pending = phase.enter(signal)
    let time = 0

    ticker.update(time)
    for (let frame = 0; frame < (PRIZE_PAUSE_MS + PRIZE_DOOR_MS * 2 + PRIZE_OPEN_HOLD_MS + PRIZE_TAKE_MS) / 10 + 20; frame++) {
      time += 10
      ticker.update(time)
      await Promise.resolve()
      await Promise.resolve()
    }

    expect(await pending).toBe(PhaseName.returning)
    expect(log).toEqual(['show', 'open', 'take', 'taken', 'close', 'hide'])
    expect(taken).toHaveBeenCalledOnce()
    output.destroy({ children: true })
    ticker.destroy()
  })

  it('отменяет анимацию при уничтожении контроллера', async () => {
    const ticker = new GameTicker()
    const output = new PrizeOutputController(ticker)
    const pending = output.open(new AbortController().signal)
    const result = expect(pending).rejects.toMatchObject({ name: 'AbortError' })

    output.destroy({ children: true })
    output.destroy({ children: true })
    await result
    ticker.destroy()
  })
})
