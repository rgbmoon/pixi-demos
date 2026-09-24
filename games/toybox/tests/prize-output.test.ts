// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

import { PRIZE_DOOR_MS, PRIZE_OPEN_HOLD_MS, PRIZE_PAUSE_MS, PRIZE_TAKE_MS } from '#src/constants'
import { PrizeOutputController } from '#src/controllers/box/prize-output'
import type { GameEvents } from '#src/events'
import { PresentingPhase } from '#src/phases/presenting'
import type { HeapStore } from '#src/stores/heap'
import { ToyboxStore } from '#src/stores/toybox'
import { PhaseName, type ToyAppearance } from '#src/types'
import { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import { GameTicker } from '@pixi-demos/engine/game-ticker'

/** Дублёр модели кучи: очередь призов без физики. */
const createQueue = (prizes: readonly ToyAppearance[]): HeapStore => {
  const queue = [...prizes]

  return {
    takePrize: () => queue.shift(),
    get prizeCount() {
      return queue.length
    },
  } as unknown as HeapStore
}

describe('выдача призов', () => {
  it('фаза соблюдает порядок операций и объявляет получение до закрытия дверцы', async () => {
    const ticker = new GameTicker()
    const output = new PrizeOutputController(ticker)
    const heap = createQueue([{ shape: 'bar2', color: 0xff0000 }])
    const emitter = new GameEmitter<GameEvents>()
    const taken = vi.fn()
    const {signal} = new AbortController()
    const phase = new PresentingPhase(ticker, output, heap, new ToyboxStore(), emitter)
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

  it('показывает призы очереди по одному и засчитывает каждый перед показом', async () => {
    const ticker = new GameTicker()
    const output = new PrizeOutputController(ticker)
    const store = new ToyboxStore()
    const prizes: ToyAppearance[] = [
      { shape: 'triangle', color: 0x00ff00 },
      { shape: 'cube8', color: 0x0000ff },
    ]
    const phase = new PresentingPhase(ticker, output, createQueue(prizes), store, new GameEmitter<GameEvents>())
    const shown: { appearance: ToyAppearance; collected: number }[] = []
    const { signal } = new AbortController()

    vi.spyOn(output, 'show').mockImplementation((appearance) => {
      shown.push({ appearance, collected: store.collected })
    })

    const results = []
    let time = 0

    ticker.update(time)
    for (let round = 0; round < 2; round++) {
      const pending = phase.enter(signal)

      for (let frame = 0; frame < (PRIZE_PAUSE_MS + PRIZE_DOOR_MS * 2 + PRIZE_OPEN_HOLD_MS + PRIZE_TAKE_MS) / 10 + 20; frame++) {
        time += 10
        ticker.update(time)
        await Promise.resolve()
        await Promise.resolve()
      }
      results.push(await pending)
    }

    expect(results).toEqual([PhaseName.presenting, PhaseName.returning])
    expect(shown).toEqual([
      { appearance: prizes[0], collected: 1 },
      { appearance: prizes[1], collected: 2 },
    ])
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
