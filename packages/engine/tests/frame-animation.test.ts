import { getEventListeners } from 'node:events'

import { Sprite, Texture } from 'pixi.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FrameAnimation } from '#src/frame-animation'
import { GameTicker } from '#src/game-ticker'
import type { FrameSequence } from '#src/types'

/** Шаг тикера, мс: границы кадров кратны ему, поэтому кадр сменяется точно на границе. */
const STEP_MS = 10

/** Длительности трёх кадров: смены кадра на 100 и 150 мс, конец последовательности на 350 мс. */
const DURATIONS = [100, 50, 200]

/** Анимация, которая открывает тесту защищённые методы базы. */
class TestAnimation extends FrameAnimation {
  constructor(ticker: GameTicker) {
    super(ticker, new Sprite())
  }

  get sprite(): Sprite {
    return this.carrier
  }

  override play(sequence: FrameSequence): void {
    super.play(sequence)
  }

  override playOnce(sequence: FrameSequence, signal?: AbortSignal): Promise<void> {
    return super.playOnce(sequence, signal)
  }
}

type Stage = {
  ticker: GameTicker
  animation: TestAnimation
  /** Подпись текстуры, которую показывает спрайт. */
  frame: () => string | undefined
  /** Крутит тикер шагами `STEP_MS` до момента `ms` от создания сцены. */
  advanceTo: (ms: number) => Promise<void>
}

const createStage = (): Stage => {
  const ticker = new GameTicker()
  const animation = new TestAnimation(ticker)
  let time = 0

  ticker.update(time)

  return {
    ticker,
    animation,
    frame: () => animation.sprite.texture.label,
    advanceTo: async (ms) => {
      while (time < ms) {
        time += STEP_MS
        ticker.update(time)
        await new Promise(setImmediate)
      }
    },
  }
}

const createSequence = (labels: readonly string[], durations: readonly number[] = DURATIONS): FrameSequence => ({
  frames: labels.map((label) => new Texture({ label })),
  durations,
})

describe('покадровая анимация', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('показывает кадр, в интервал которого попадает время, и повторяет цикл', async () => {
    const { animation, frame, advanceTo } = createStage()
    const timeline = [
      [0, 'a'],
      [90, 'a'],
      [100, 'b'],
      [140, 'b'],
      [150, 'c'],
      [340, 'c'],
      [350, 'a'],
      [450, 'b'],
    ] as const

    animation.play(createSequence(['a', 'b', 'c']))

    for (const [ms, label] of timeline) {
      await advanceTo(ms)

      expect(frame(), `${ms} мс`).toBe(label)
    }
  })

  it('playOnce резолвится в конце последнего кадра, оставляет его и снимает подписки', async () => {
    const { ticker, animation, frame, advanceTo } = createStage()
    // Сигнал автомата живёт всю игру: забытый обработчик копился бы с каждой анимацией
    const { signal } = new AbortController()
    let isPlayed = false
    const played = (async () => {
      await animation.playOnce(createSequence(['a', 'b', 'c']), signal)
      isPlayed = true
    })()

    await advanceTo(340)

    expect(isPlayed).toBe(false)

    await advanceTo(350)

    expect(isPlayed).toBe(true)

    await played
    await advanceTo(500)

    expect(frame()).toBe('c')
    expect(ticker.count).toBe(0)
    expect(getEventListeners(signal, 'abort')).toHaveLength(0)
  })

  it('playOnce реджектится по signal и оставляет текущий кадр', async () => {
    const { ticker, animation, frame, advanceTo } = createStage()
    const abort = new AbortController()
    const played = animation.playOnce(createSequence(['a', 'b', 'c']), abort.signal)
    const rejected = expect(played).rejects.toMatchObject({ name: 'AbortError' })

    await advanceTo(120)
    abort.abort()
    await rejected
    await advanceTo(400)

    expect(frame()).toBe('b')
    expect(ticker.count).toBe(0)
  })

  it('новый вызов резолвит незаконченный playOnce и запускает свою последовательность', async () => {
    const { animation, frame, advanceTo } = createStage()
    const interrupted = animation.playOnce(createSequence(['a', 'b', 'c']))

    await advanceTo(120)
    animation.play(createSequence(['d', 'e', 'f']))

    await expect(interrupted).resolves.toBeUndefined()
    expect(frame()).toBe('d')

    await advanceTo(220)

    expect(frame()).toBe('e')
  })

  it('destroy резолвит незаконченный playOnce и снимает колбэк с тикера', async () => {
    const { ticker, animation, advanceTo } = createStage()
    const interrupted = animation.playOnce(createSequence(['a', 'b', 'c']))

    await advanceTo(120)
    animation.destroy({ children: true })

    await expect(interrupted).resolves.toBeUndefined()
    expect(ticker.count).toBe(0)
  })

  it('при уменьшенном движении playOnce сразу ставит последний кадр, а play — первый без тикера', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))

    const { ticker, animation, frame } = createStage()

    await animation.playOnce(createSequence(['a', 'b', 'c']))

    expect(frame()).toBe('c')

    animation.play(createSequence(['a', 'b', 'c']))

    expect(frame()).toBe('a')
    expect(ticker.count).toBe(0)
  })

  it('ставит спрайту якорь кадра из атласа, а кадр без якоря якорь не меняет', async () => {
    const { animation, advanceTo } = createStage()
    const anchor = () => ({ x: animation.sprite.anchor.x, y: animation.sprite.anchor.y })

    animation.play({
      frames: [
        new Texture({ defaultAnchor: { x: 0.5, y: 1 } }),
        new Texture(),
        new Texture({ defaultAnchor: { x: 0.25, y: 0.75 } }),
      ],
      durations: DURATIONS,
    })

    expect(anchor()).toEqual({ x: 0.5, y: 1 })

    await advanceTo(100)

    expect(anchor()).toEqual({ x: 0.5, y: 1 })

    await advanceTo(150)

    expect(anchor()).toEqual({ x: 0.25, y: 0.75 })
  })

  it('не запускает последовательность, у которой число кадров и длительностей разное', () => {
    const { animation } = createStage()

    expect(() => animation.play(createSequence(['a', 'b'], [100]))).toThrow()
  })
})
