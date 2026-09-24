// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RESET_MS, WELCOME_MS } from '#src/constants'
import { MarqueeController } from '#src/controllers/box/marquee'
import type { GameEvents } from '#src/events'
import { ToyboxStore } from '#src/stores/toybox'
import { Marquee } from '#src/ui/box/marquee'
import { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import { GameTicker } from '@pixi-demos/engine/game-ticker'

/** Шаг кадра при 60 fps. */
const FRAME_MS = 1000 / 60

type Board = {
  store: ToyboxStore
  emitter: GameEmitter<GameEvents>
  /** Последний текст, выведенный на табло. */
  message: () => string | undefined
  /** Крутит кадры игры `ms` миллисекунд. */
  wait: (ms: number) => Promise<void>
  destroy: () => void
}

const createBoard = (): Board => {
  const setMessage = vi.spyOn(Marquee.prototype, 'setMessage')
  const ticker = new GameTicker()
  const store = new ToyboxStore()
  const emitter = new GameEmitter<GameEvents>()
  const marquee = new MarqueeController(ticker, store, emitter)
  let time = 0

  ticker.update(time)

  return {
    store,
    emitter,
    message: () => setMessage.mock.lastCall?.[0],
    wait: async (ms) => {
      for (let passed = 0; passed < ms; passed += FRAME_MS) {
        time += FRAME_MS
        ticker.update(time)
        await new Promise(setImmediate)
      }
    },
    destroy: () => {
      marquee.destroy({ children: true })
      ticker.destroy()
    },
  }
}

describe('табло', () => {
  let board: Board | undefined

  afterEach(() => {
    board?.destroy()
    board = undefined
    vi.restoreAllMocks()
  })

  it('показывает WELCOME после загрузки, а по его истечении — счёт', async () => {
    board = createBoard()
    board.store.applyCollected(3)
    board.emitter.emit('game:booted')

    expect(board.message()).toBe('WELCOME')

    await board.wait(WELCOME_MS - 100)

    expect(board.message()).toBe('WELCOME')

    await board.wait(200)

    expect(board.message()).toBe('TOYS 3')
  })

  it('показывает RESET после сброса, а по его истечении — обнулённый счёт', async () => {
    board = createBoard()
    board.emitter.emit('game:booted')
    await board.wait(WELCOME_MS)
    board.store.applyCollected(0)
    board.emitter.emit('heap:reset')

    expect(board.message()).toBe('RESET')

    await board.wait(RESET_MS - 100)

    expect(board.message()).toBe('RESET')

    await board.wait(200)

    expect(board.message()).toBe('TOYS 0')
  })

  it('обновляет счёт в момент получения приза', async () => {
    board = createBoard()
    board.emitter.emit('game:booted')
    await board.wait(WELCOME_MS)
    board.store.recordCollection()
    board.emitter.emit('prize:taken')

    expect(board.message()).toBe('TOYS 1')
  })

  it('держит RESET весь его срок, даже если сброс пришёл посреди WELCOME', async () => {
    board = createBoard()
    board.store.applyCollected(2)
    board.emitter.emit('game:booted')
    await board.wait(WELCOME_MS - 500)
    board.store.applyCollected(0)
    board.emitter.emit('heap:reset')
    // Срок WELCOME истекает, пока на табло RESET: табло не возвращается к счёту раньше времени
    await board.wait(600)

    expect(board.message()).toBe('RESET')

    await board.wait(RESET_MS)

    expect(board.message()).toBe('TOYS 0')
  })
})
