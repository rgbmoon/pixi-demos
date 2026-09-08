// @vitest-environment jsdom
import { NoticeSeverity } from 'src/core/errors/types'
import { onNotice } from 'src/core/errors/utils'
import { GameEmitter } from 'src/core/events/game-emitter'
import { Fsm } from 'src/core/fsm/fsm'
import type { Phase, PhaseSink } from 'src/core/fsm/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const createSink = () => {
  const visited: string[] = []

  return { visited, sink: { setPhase: (phase: string) => visited.push(phase) } satisfies PhaseSink }
}

const createPhase = (name: string, enter: Phase['enter'], exit?: () => void): Phase => ({ name, enter, exit })

describe('Fsm', () => {
  const notices: { severity: string; message: string }[] = []
  let offNotice: () => void

  beforeEach(() => {
    notices.length = 0
    offNotice = onNotice((notice) => notices.push(notice))
    // traceError и tracePhase печатают в консоль на DEV-сборке, а тесты идут именно в ней
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  afterEach(() => {
    offNotice()
    vi.restoreAllMocks()
  })

  it('падает на сборке, если фаза из конфига не забиндена', () => {
    const { sink } = createSink()

    expect(() => new Fsm([createPhase('a', () => 'a')], sink, { initial: 'a', names: ['a', 'b'] })).toThrow(
      'missing binding for phase b'
    )
  })

  it('публикует фазы в порядке обхода', async () => {
    const { visited, sink } = createSink()
    const emitter = new GameEmitter<{ tick: void }>()

    let markLooped: () => void = () => {}
    const looped = new Promise<void>((resolve) => {
      markLooped = resolve
    })

    const phases = [
      createPhase('a', () => 'b'),
      createPhase('b', async (signal) => {
        // Второй заход в «a» закрывает круг: дальше фаза засыпает и ждёт остановки
        if (visited.filter((name) => name === 'a').length > 1) {
          markLooped()

          await emitter.waitFor('tick', { signal })
        }

        return 'a'
      }),
    ]

    const fsm = new Fsm(phases, sink, { initial: 'a', names: ['a', 'b'] })
    const started = fsm.start()

    await looped
    fsm.dispose()
    await started

    expect(visited).toEqual(['a', 'b', 'a', 'b'])
  })

  it('зовёт exit на каждой итерации, включая ошибочную', async () => {
    const { sink } = createSink()
    const exitOk = vi.fn()
    const exitFailing = vi.fn()

    const phases = [
      createPhase('a', () => 'b', exitOk),
      createPhase(
        'b',
        () => {
          throw new Error('phase failed')
        },
        exitFailing
      ),
    ]

    await new Fsm(phases, sink, { initial: 'a', names: ['a', 'b'] }).start()

    expect(exitOk).toHaveBeenCalledOnce()
    expect(exitFailing).toHaveBeenCalledOnce()
  })

  it('останавливает петлю навсегда после ошибки фазы', async () => {
    const { visited, sink } = createSink()
    const afterFailure = vi.fn(() => 'a')

    const phases = [
      createPhase('a', () => {
        throw new Error('phase failed')
      }),
      createPhase('b', afterFailure),
    ]

    const fsm = new Fsm(phases, sink, { initial: 'a', names: ['a', 'b'] })

    // start() не реджектится: ошибку фазы движок объявляет уведомлением, а не отказом промиса
    await expect(fsm.start()).resolves.toBeUndefined()

    expect(notices).toEqual([expect.objectContaining({ severity: NoticeSeverity.fatal })])
    expect(afterFailure).not.toHaveBeenCalled()
    expect(visited).toEqual(['a'])
  })

  it('выходит из петли по остановке молча', async () => {
    const { sink } = createSink()
    const emitter = new GameEmitter<{ tick: void }>()

    let markEntered: () => void = () => {}
    const entered = new Promise<void>((resolve) => {
      markEntered = resolve
    })

    // Боевой путь остановки: фаза спит на событии, а игрок уходит со страницы
    const phases = [
      createPhase('a', async (signal) => {
        markEntered()

        await emitter.waitFor('tick', { signal })

        return 'a'
      }),
    ]

    const fsm = new Fsm(phases, sink, { initial: 'a', names: ['a'] })
    const started = fsm.start()

    await entered
    fsm.dispose()

    await expect(started).resolves.toBeUndefined()
    expect(notices).toEqual([])
    expect(emitter.listenerCounts()).toEqual({})
  })

  it('не входит ни в одну фазу, если остановлен до запуска', async () => {
    const { visited, sink } = createSink()
    const enter = vi.fn(() => 'a')

    const fsm = new Fsm([createPhase('a', enter)], sink, { initial: 'a', names: ['a'] })

    fsm.dispose()
    await fsm.start()

    expect(enter).not.toHaveBeenCalled()
    expect(visited).toEqual([])
  })
})
