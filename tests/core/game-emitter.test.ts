import { GameEmitter } from 'src/core/events/game-emitter'
import { afterEach, describe, expect, it, vi } from 'vitest'

type TestEvents = {
  ping: void
  data: number
}

const createEmitter = () => new GameEmitter<TestEvents>()

/** Ни один путь выхода не должен оставлять подписчика: сумма счётчиков — детектор утечки. */
const totalListeners = (emitter: GameEmitter<TestEvents>): number =>
  Object.values(emitter.listenerCounts()).reduce((sum, count) => sum + count, 0)

describe('GameEmitter', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('снимает подписку возвращённой функцией', () => {
    const emitter = createEmitter()
    const handler = vi.fn()

    const off = emitter.on('data', handler)

    emitter.emit('data', 1)
    off()
    emitter.emit('data', 2)

    expect(handler).toHaveBeenCalledExactlyOnceWith(1)
    expect(totalListeners(emitter)).toBe(0)
  })

  it('дожидается события и отдаёт его payload', async () => {
    const emitter = createEmitter()
    const arrived = emitter.waitFor('data')

    emitter.emit('data', 42)

    await expect(arrived).resolves.toBe(42)
    expect(totalListeners(emitter)).toBe(0)
  })

  it('пропускает события, не прошедшие фильтр', async () => {
    const emitter = createEmitter()
    const arrived = emitter.waitFor('data', { filter: (value) => value > 10 })

    emitter.emit('data', 1)
    emitter.emit('data', 50)

    await expect(arrived).resolves.toBe(50)
    expect(totalListeners(emitter)).toBe(0)
  })

  it('реджектит ожидание по отмене', async () => {
    const emitter = createEmitter()
    const controller = new AbortController()
    const arrived = emitter.waitFor('data', { signal: controller.signal })

    controller.abort(new Error('cancelled'))

    await expect(arrived).rejects.toThrow('cancelled')
    expect(totalListeners(emitter)).toBe(0)
  })

  it('реджектит ожидание, если сигнал уже отменён', async () => {
    const emitter = createEmitter()

    await expect(emitter.waitFor('data', { signal: AbortSignal.abort(new Error('gone')) })).rejects.toThrow('gone')
    expect(totalListeners(emitter)).toBe(0)
  })

  it('реджектит ожидание по таймауту', async () => {
    vi.useFakeTimers()

    const emitter = createEmitter()
    // Таймаут идёт по системному времени: в свёрнутой вкладке тикер стоит, а ожидание обязано сорваться
    const arrived = emitter.waitFor('ping', { timeoutMs: 1000 })

    vi.advanceTimersByTime(1000)

    await expect(arrived).rejects.toThrow('did not arrive within 1000 ms')
    expect(totalListeners(emitter)).toBe(0)
  })
})
