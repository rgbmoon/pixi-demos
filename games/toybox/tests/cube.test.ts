// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { ClawRig } from '#src/claw/claw-rig'
import { CLAW_GRAB_MS, FIELD_CENTER, TRAY_CENTER } from '#src/constants'
import { CubeController } from '#src/controllers/box/cube'
import type { ToyBody } from '#src/heap/types'
import { ToyboxStore } from '#src/stores/toybox'
import { GameTicker } from '@pixi-demos/engine/game-ticker'

import { createHeap, stand } from './setup/heap'

/** Длина кадра на пределе PIXI: тикер режет кадр до 100 мс. */
const FRAME_MS = 100

describe('кадр куба', () => {
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
})
