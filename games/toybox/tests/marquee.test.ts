// @vitest-environment jsdom
import { BitmapText, type Container } from 'pixi.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CABINET_BOTTOM_Z,
  MARQUEE_SCREEN_FRAME,
  MARQUEE_SCROLL_STEP_MS,
  MARQUEE_TEXT_INSET,
  RESET_MS,
  WELCOME_MS,
} from '#src/constants'
import { MarqueeController } from '#src/controllers/box/marquee'
import type { GameEvents } from '#src/events'
import { FloorPile } from '#src/heap/floor-pile'
import { ToyboxStore } from '#src/stores/toybox'
import { Marquee } from '#src/ui/box/marquee'
import { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import { GameTicker } from '@pixi-demos/engine/game-ticker'

/** Шаг кадра при 60 fps. */
const FRAME_MS = 1000 / 60

type Board = {
  view: Marquee
  store: ToyboxStore
  floorPile: FloorPile
  emitter: GameEmitter<GameEvents>
  /** Последний текст, выведенный на табло. */
  message: () => string | undefined
  /** Число горящих ламп по последнему вызову табло. */
  litLamps: () => number | undefined
  /** Крутит кадры игры `ms` миллисекунд. */
  wait: (ms: number) => Promise<void>
  destroy: () => void
}

const createBoard = (): Board => {
  const setMessage = vi.spyOn(Marquee.prototype, 'setMessage')
  const setLitLamps = vi.spyOn(Marquee.prototype, 'setLitLamps')
  const ticker = new GameTicker()
  const store = new ToyboxStore()
  const floorPile = new FloorPile()
  const emitter = new GameEmitter<GameEvents>()
  const marquee = new MarqueeController(ticker, store, floorPile, emitter)
  let time = 0

  ticker.update(time)

  return {
    view: marquee.children[0] as Marquee,
    store,
    floorPile,
    emitter,
    message: () => setMessage.mock.lastCall?.[0],
    litLamps: () => setLitLamps.mock.lastCall?.[0],
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

  it('зажигает по лампе на каждую выигранную игрушку с лампой и гасит лампы при сбросе', () => {
    board = createBoard()
    board.emitter.emit('game:booted')

    expect(board.litLamps()).toBe(0)

    board.floorPile.drop({ toy: 'duck', hasLamp: true }, () => 0.5)
    board.emitter.emit('prize:taken')

    expect(board.litLamps()).toBe(1)

    // Игрушка без лампы новую лампу не зажигает
    board.floorPile.drop({ toy: 'giraffe' }, () => 0.5)
    board.emitter.emit('prize:taken')
    board.floorPile.drop({ toy: 'teddy', hasLamp: true }, () => 0.5)
    board.emitter.emit('prize:taken')

    expect(board.litLamps()).toBe(2)

    // Сброс чистит пол раньше, чем табло узнаёт о нём
    board.floorPile.restore([])
    board.emitter.emit('heap:reset')

    expect(board.litLamps()).toBe(0)
  })

  it('после загрузки зажигает лампы по игрушкам с лампой, лежащим на полу', () => {
    const toy = {
      slab: 0,
      y: 4,
      z: CABINET_BOTTOM_Z + 0.5,
      angle: 0,
      toy: 'duck',
    } as const

    board = createBoard()
    board.floorPile.restore([
      { ...toy, hasLamp: true },
      { ...toy, y: 6 },
      { ...toy, y: 2, hasLamp: true },
    ])
    board.emitter.emit('game:booted')

    expect(board.litLamps()).toBe(2)
  })

  it('ставит умещающийся текст неподвижно у левого края, а более широкий ведёт бегущей строкой по кругу', async () => {
    board = createBoard()

    const marquee = board.view
    const text = findText(marquee)

    if (!text) throw new Error('No marquee text')

    marquee.setMessage('TOYS 3')
    await board.wait(MARQUEE_SCROLL_STEP_MS * 4)

    expect(text.x).toBe(MARQUEE_SCREEN_FRAME + MARQUEE_TEXT_INSET)

    marquee.setMessage('A VERY LONG MESSAGE THAT DOES NOT FIT THE SCREEN')

    const start = text.x

    await board.wait(MARQUEE_SCROLL_STEP_MS * 10)

    expect(text.x).toBeLessThan(start)
    expect(start - text.x).toBeGreaterThanOrEqual(9)

    // Строка целиком ушла за левый край и снова входит справа
    await board.wait(MARQUEE_SCROLL_STEP_MS * (start + text.width))

    expect(text.x).toBeGreaterThanOrEqual(start - 12)
    expect(text.x).toBeLessThanOrEqual(start)
  })
})

/** Текст табло среди потомков вида. */
const findText = (root: Container): BitmapText | undefined => {
  for (const child of root.children) {
    const found = child instanceof BitmapText ? child : findText(child)

    if (found) return found
  }

  return undefined
}
