// @vitest-environment jsdom
import { Assets, type Container, Sprite, Texture } from 'pixi.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { CLAW_ATLAS, CLAW_FRAMES, CLAW_SEQUENCES, TOY_SEQUENCES, TOYS_ATLAS } from '#src/assets'
import { ClawRig } from '#src/claw/claw-rig'
import { CLAW_GRAB_MS, FIELD_CENTER, TRAY_CENTER } from '#src/constants'
import { CubeController } from '#src/controllers/box/cube'
import type { ToyBody } from '#src/heap/types'
import { ToyboxStore } from '#src/stores/toybox'
import { Claw } from '#src/ui/box/claw'
import { Toy } from '#src/ui/box/toy'
import { GameTicker } from '@pixi-demos/engine/game-ticker'

import { createHeap, stand } from './setup/heap'

/** Длина кадра на пределе PIXI: тикер режет кадр до 100 мс. */
const FRAME_MS = 100

/** Кадры клешни в заглушке атласа: раскрытая, сжатая и задний палец. */
const OPEN = new Texture()
const CLOSED = new Texture()
const BACK = new Texture()

describe('кадр куба', () => {
  // Тест атласы не грузит, а клешне нужны кадры поворота, поз и текстура троса
  beforeEach(() => {
    for (const frame of Object.values(CLAW_FRAMES)) Assets.cache.set(frame, Texture.WHITE)
    Assets.cache.set(CLAW_ATLAS, {
      animations: {
        [CLAW_SEQUENCES.open]: [OPEN],
        [CLAW_SEQUENCES.closed]: [CLOSED],
        [CLAW_SEQUENCES.back]: [BACK],
      },
    })
    Assets.cache.set(TOYS_ATLAS, {
      animations: Object.fromEntries(
        Object.values(TOY_SEQUENCES)
          .flat()
          .flatMap(({ body, outline }) => [body, outline])
          .map((sequence) => [sequence, Array<Texture>(72).fill(Texture.WHITE)])
      ),
    })
  })

  afterEach(() => {
    for (const frame of Object.values(CLAW_FRAMES)) Assets.cache.remove(frame)
    Assets.cache.remove(CLAW_ATLAS)
    Assets.cache.remove(TOYS_ATLAS)
  })

  it('ведёт игрушку в клешне в том же кадре, что клешню, и доставляет её центр точно над лотком', async () => {
    const ticker = new GameTicker()
    const rig = new ClawRig()
    const heap = createHeap([stand('cube8', 3, FIELD_CENTER.y, 0)])
    const cube = new CubeController(ticker, heap, new ToyboxStore(), rig)
    const body = heap.getTopBodyAt(FIELD_CENTER) as Readonly<ToyBody>
    const grip = rig.getGripPoint()
    const hang = body.pose.point.z - grip.z
    let time = 0
    const frame = (ms = FRAME_MS) => {
      time += ms
      ticker.update(time)
    }

    heap.lift(FIELD_CENTER, grip)
    ticker.update(time)

    const grab = rig.grab(new AbortController().signal)

    for (let elapsed = 0; elapsed < CLAW_GRAB_MS; elapsed += FRAME_MS) frame(Math.min(FRAME_MS, CLAW_GRAB_MS - elapsed))
    await grab

    const move = rig.carryTo(TRAY_CENTER, undefined)

    // За время захвата игрушка встала под клешню: дальше она повторяет точку захвата в каждом кадре
    for (let count = 0; count < 35; count++) {
      frame()

      const current = rig.getGripPoint()

      expect(body.pose.point.x).toBeCloseTo(current.x, 12)
      expect(body.pose.point.y).toBeCloseTo(current.y, 12)
      expect(body.pose.point.z).toBeCloseTo(current.z + hang, 12)
    }

    await move

    expect(body.pose.point.x).toBeCloseTo(TRAY_CENTER.x, 12)
    expect(body.pose.point.y).toBeCloseTo(TRAY_CENTER.y, 12)

    cube.destroy({ children: true })
    ticker.destroy()
  })

  it('рисует игрушку в захвате между задним пальцем и клешней и возвращает её в слой, когда игрушка выпала', async () => {
    const ticker = new GameTicker()
    const rig = new ClawRig()
    const heap = createHeap([stand('cube8', 3, FIELD_CENTER.y, 0)])
    const cube = new CubeController(ticker, heap, new ToyboxStore(), rig)
    let time = 0
    const frame = () => {
      time += FRAME_MS
      ticker.update(time)
    }

    heap.lift(FIELD_CENTER, rig.getGripPoint())
    frame()

    const grab = rig.grab(new AbortController().signal)

    for (let elapsed = 0; elapsed < 2 * CLAW_GRAB_MS; elapsed += FRAME_MS) frame()
    await grab

    const claw = findNode(cube, (node) => node instanceof Claw)
    const toy = findNode(cube, (node) => node instanceof Toy)
    const order = flatten(claw)
    const back = order.findIndex((node) => node instanceof Sprite && node.texture === BACK)
    const front = order.findIndex((node) => node instanceof Sprite && node.texture === CLOSED)

    expect(back).toBeGreaterThanOrEqual(0)
    expect(order.indexOf(toy)).toBeGreaterThan(back)
    expect(order.indexOf(toy)).toBeLessThan(front)

    heap.release(rig.getGripPoint())
    frame()

    expect(flatten(claw)).not.toContain(toy)
    expect(flatten(cube)).toContain(toy)

    cube.destroy({ children: true })
    ticker.destroy()
  })
})

/** Первый узел дерева View-компонента, прошедший проверку. */
const findNode = (root: Container, test: (node: Container) => boolean): Container => {
  const node = flatten(root).find(test)

  if (!node) throw new Error('Node not found')

  return node
}

/** Узлы дерева в порядке отрисовки без сортировки по `zIndex`: родитель, затем дети по порядку. */
const flatten = (root: Container): Container[] => [root, ...root.children.flatMap((child) => flatten(child))]
