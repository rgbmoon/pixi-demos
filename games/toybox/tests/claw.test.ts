import { getEventListeners } from 'node:events'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { ClawRig } from '#src/claw/claw-rig'
import { CLAW_MAX_SPEED, CLAW_REST_HEIGHT, SWAY_MAX_OFFSET } from '#src/claw/constants'
import { pickFumbleShare } from '#src/claw/utils'
import { CART_SIZE, FIELD_CENTER, FUMBLE_START_CLEARANCE, GRID_SIZE, TRAY_CENTER, TRAY_ORIGIN, TRAY_SIZE } from '#src/constants'
import type { ClawDrop, GroundPoint, WorldPoint } from '#src/types'
import { createRandom } from '@pixi-demos/core/random'

/** Шаг кадра при 60 fps. */
const FRAME_MS = 1000 / 60

/** Предохранитель: движение, которое не кончилось за столько кадров, считается зависшим. */
const MAX_FRAMES = 2000

const STILL: GroundPoint = { x: 0, y: 0 }
const FORWARD: GroundPoint = { x: 1, y: 0 }
const BACKWARD: GroundPoint = { x: -1, y: 0 }

/** Сколько кадров хватает, чтобы качание улеглось: несколько периодов маятника. */
const SETTLE_FRAMES = 90

/** Сколько потерь по дороге разыгрывать там, где проверяется доля исходов, а не один исход. */
const ROLLS = 200

/** Смещение клешни от каретки по осям поля: отклонение троса. */
const getSwing = (rig: ClawRig): GroundPoint => {
  const cart = rig.getCartPoint()
  const grip = rig.getGripPoint()

  return { x: grip.x - cart.x, y: grip.y - cart.y }
}

/** Ведёт каретку вводом `frames` кадров; отвечает её путём за каждый кадр. */
const drive = (rig: ClawRig, direction: GroundPoint, frames: number, frameMs = FRAME_MS): number[] => {
  const steps: number[] = []

  for (let frame = 0; frame < frames; frame++) {
    const from = rig.getCartPoint()

    rig.advance(frameMs, direction)

    const to = rig.getCartPoint()

    steps.push(Math.hypot(to.x - from.x, to.y - from.y))
  }

  return steps
}

/** Крутит кадры, пока движение фазы не кончится; отвечает числом кадров. */
const finish = async (rig: ClawRig, motion: Promise<void>, direction = STILL): Promise<number> => {
  let done = false
  const tracked = (async () => {
    await motion
    done = true
  })()

  for (let frame = 1; frame <= MAX_FRAMES; frame++) {
    rig.advance(FRAME_MS, direction)
    await new Promise(setImmediate)

    if (done) {
      await tracked

      return frame
    }
  }

  throw new Error('Claw motion never finished')
}

/** Лежит ли точка пола над лотком. */
const isOverTray = ({ x, y }: GroundPoint): boolean =>
  x >= TRAY_ORIGIN.x && x <= TRAY_ORIGIN.x + TRAY_SIZE && y >= TRAY_ORIGIN.y && y <= TRAY_ORIGIN.y + TRAY_SIZE

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('клешня: ход по вводу игрока', () => {
  it('разгоняет каретку за несколько кадров до предельной скорости и не превышает её', () => {
    const speeds = drive(new ClawRig(), FORWARD, 30).map((step) => step / (FRAME_MS / 1000))

    expect(speeds[0]).toBeLessThan(CLAW_MAX_SPEED / 2)
    expect(speeds[5]).toBeCloseTo(CLAW_MAX_SPEED, 9)
    for (const speed of speeds) expect(speed).toBeLessThanOrEqual(CLAW_MAX_SPEED + 1e-9)
  })

  it('не разгоняет каретку по диагонали быстрее, чем по оси', () => {
    const rig = new ClawRig()
    const [last] = drive(rig, { x: Math.SQRT1_2, y: Math.SQRT1_2 }, 20).slice(-1)
    const { x, y } = rig.getCartPoint()

    expect(last / (FRAME_MS / 1000)).toBeCloseTo(CLAW_MAX_SPEED, 9)
    expect(x - FIELD_CENTER.x).toBeCloseTo(y - FIELD_CENTER.y, 12)
  })

  it('останавливает каретку за доли секунды почти на месте и не даёт ей ползти', () => {
    const rig = new ClawRig()

    drive(rig, FORWARD, 20)

    const braking = drive(rig, STILL, 60)
    const stopped = braking.indexOf(0)

    // Остановка укладывается в четверть секунды и в треть ячейки пути
    expect(stopped).toBeGreaterThan(0)
    expect(stopped).toBeLessThan(15)
    expect(braking.reduce((sum, step) => sum + step, 0)).toBeLessThan(0.35)
    expect(braking.slice(stopped).every((step) => step === 0)).toBe(true)
  })

  it('держит каретку у стенки поля и отводит от неё в первом же кадре разворота', () => {
    const rig = new ClawRig()

    drive(rig, BACKWARD, 180)

    expect(rig.getCartPoint().x).toBe(CART_SIZE / 2)

    drive(rig, FORWARD, 1)

    expect(rig.getCartPoint().x).toBeGreaterThan(CART_SIZE / 2)
  })
})

describe('клешня: качание на тросе', () => {
  /** Клешня у ближней стенки: впереди полный ход через поле. */
  const createRigAtWall = async (): Promise<ClawRig> => {
    const rig = new ClawRig()

    await finish(rig, rig.moveTo({ x: CART_SIZE / 2, y: FIELD_CENTER.y }))
    drive(rig, STILL, SETTLE_FRAMES)

    return rig
  }

  it('отводит клешню против хода, держит отклонение на ровном ходу и успокаивает её под кареткой', async () => {
    const rig = await createRigAtWall()

    drive(rig, FORWARD, 6)

    expect(getSwing(rig).x).toBeLessThan(0)

    // На ровном ходу отклонение замирает, а не возвращается под каретку
    drive(rig, FORWARD, SETTLE_FRAMES - 10)

    const steady = getSwing(rig).x

    drive(rig, FORWARD, 10)

    expect(steady).toBeLessThan(0)
    expect(getSwing(rig).x).toBeCloseTo(steady, 9)

    // После остановки клешня проходит отвес вперёд и замирает ровно под кареткой
    let peak = 0

    for (let frame = 0; frame < SETTLE_FRAMES; frame++) {
      drive(rig, STILL, 1)
      peak = Math.max(peak, getSwing(rig).x)
    }

    expect(peak).toBeGreaterThan(0)
    expect(getSwing(rig)).toEqual({ x: 0, y: 0 })
  })

  it('не раскачивает клешню сильнее на кадрах 100 мс, чем на кадрах 60 fps', async () => {
    const peakOf = async (frameMs: number): Promise<number> => {
      const rig = await createRigAtWall()
      const frames = Math.round(1000 / frameMs)
      let peak = 0

      for (let frame = 0; frame < frames * 3; frame++) {
        drive(rig, frame < frames ? FORWARD : STILL, 1, frameMs)
        peak = Math.max(peak, Math.abs(getSwing(rig).x))
      }

      expect(getSwing(rig)).toEqual({ x: 0, y: 0 })

      return peak
    }

    // PIXI отдаёт кадр длиной до 100 мс: на нём явная схема пружины разошлась бы
    expect(await peakOf(100)).toBeLessThanOrEqual((await peakOf(FRAME_MS)) * 1.5)
  })

  it('не отводит клешню дальше предела ни на разворотах, ни на переездах', async () => {
    const rig = await createRigAtWall()
    let peak = 0
    const track = () => {
      peak = Math.max(peak, Math.hypot(getSwing(rig).x, getSwing(rig).y))
    }

    for (let frame = 0; frame < 120; frame++) {
      drive(rig, frame % 40 < 20 ? FORWARD : BACKWARD, 1)
      track()
    }

    const travel = rig.carryTo({ x: GRID_SIZE - CART_SIZE / 2, y: CART_SIZE / 2 }, undefined)
    let done = false
    const tracked = (async () => {
      await travel
      done = true
    })()

    for (let frame = 0; frame < MAX_FRAMES && !done; frame++) {
      rig.advance(FRAME_MS, STILL)
      track()
      await new Promise(setImmediate)
    }

    await tracked

    expect(peak).toBeLessThanOrEqual(SWAY_MAX_OFFSET)
  })
})

describe('клешня: движения фаз', () => {
  it('доводит каретку и клешню точно до цели', async () => {
    const rig = new ClawRig()
    const target = { x: 2.25, y: 6.5 }

    await finish(rig, rig.moveTo(target))

    expect(rig.getCartPoint()).toEqual({ ...target, z: expect.any(Number) as number })

    await finish(rig, rig.descend(1.75))

    expect(rig.getGripPoint().z).toBe(1.75)

    await finish(rig, rig.grab(new AbortController().signal))
    await finish(rig, rig.ascend())

    expect(rig.getGripPoint().z).toBe(CLAW_REST_HEIGHT)
    expect(rig.getCartPoint()).toMatchObject(target)
  })

  it('не слушает ввод игрока, пока идёт движение фазы', async () => {
    const pathOf = async (direction: GroundPoint): Promise<WorldPoint[]> => {
      const rig = new ClawRig()
      const path: WorldPoint[] = []
      let done = false
      const motion = (async () => {
        await rig.moveTo({ x: 1.5, y: 6 })
        done = true
      })()

      while (!done) {
        rig.advance(FRAME_MS, direction)
        path.push(rig.getGripPoint())
        await new Promise(setImmediate)
      }

      await motion

      return path
    }

    expect(await pathOf({ x: 0, y: 1 })).toEqual(await pathOf(STILL))
  })

  it('перед отпусканием над лотком ждёт, пока клешня перестанет качаться', async () => {
    const moving = new ClawRig()
    const carrying = new ClawRig()
    const movedIn = await finish(moving, moving.moveTo(TRAY_CENTER))
    const carriedIn = await finish(carrying, carrying.carryTo(TRAY_CENTER, undefined))

    // Переезд кончается с клешнёй, ещё качающейся на тросе; доставка — только когда она замерла над лотком
    expect(getSwing(moving)).not.toEqual({ x: 0, y: 0 })
    expect(getSwing(carrying)).toEqual({ x: 0, y: 0 })
    expect(carriedIn).toBeGreaterThan(movedIn)
  })
})

describe('клешня: потеря игрушки на ходу', () => {
  it.each([false, true])('роняет игрушку на заданной доле подъёма; уменьшенное движение: %s', async (reduced) => {
    vi.stubGlobal('matchMedia', () => ({ matches: reduced }))

    const rig = new ClawRig()
    const drops: { grip: WorldPoint; current: WorldPoint }[] = []

    await finish(rig, rig.descend(1))

    const slip: ClawDrop = { share: 0.3, onDrop: (grip) => drops.push({ grip, current: rig.getGripPoint() }) }

    await finish(rig, rig.ascend(slip))

    expect(drops).toHaveLength(1)
    expect(drops[0].grip).toEqual(drops[0].current)
    expect(drops[0].grip.z).toBeCloseTo(1 + (CLAW_REST_HEIGHT - 1) * 0.3, 12)
  })

  it.each([false, true])('роняет игрушку на заданной доле пути каретки; уменьшенное движение: %s', async (reduced) => {
    vi.stubGlobal('matchMedia', () => ({ matches: reduced }))

    const rig = new ClawRig()
    const from = rig.getCartPoint()
    const target = { x: 1, y: 7 }
    const drops: { grip: WorldPoint; current: WorldPoint; cart: WorldPoint }[] = []
    const drop: ClawDrop = {
      share: 0.31,
      onDrop: (grip) => drops.push({ grip, current: rig.getGripPoint(), cart: rig.getCartPoint() }),
    }

    await finish(rig, rig.carryTo(target, drop))

    expect(drops).toHaveLength(1)
    expect(drops[0].grip).toEqual(drops[0].current)
    expect(drops[0].cart.x).toBeCloseTo(from.x + (target.x - from.x) * 0.31, 12)
    expect(drops[0].cart.y).toBeCloseTo(from.y + (target.y - from.y) * 0.31, 12)
  })

  it('роняет игрушку над кубом: дальше порога от места захвата и до входа в лоток', () => {
    const random = createRandom(2)
    const from = { x: 4, y: 4 }
    const at = (share: number): GroundPoint => ({
      x: from.x + (TRAY_CENTER.x - from.x) * share,
      y: from.y + (TRAY_CENTER.y - from.y) * share,
    })

    for (let run = 0; run < ROLLS; run++) {
      const point = at(pickFumbleShare(from, TRAY_CENTER, random) as number)

      expect(Math.hypot(point.x - from.x, point.y - from.y)).toBeGreaterThanOrEqual(FUMBLE_START_CLEARANCE - 1e-9)
      expect(isOverTray(point)).toBe(false)
    }

    // Крайние броски дают границы участка: порог от места захвата и вход в лоток
    const [first, last] = [0, 0.999999].map((roll) => pickFumbleShare(from, TRAY_CENTER, () => roll) as number)

    expect(Math.hypot(at(first).x - from.x, at(first).y - from.y)).toBeCloseTo(FUMBLE_START_CLEARANCE, 9)
    expect(isOverTray(at(last + 0.01))).toBe(true)
  })

  it('не роняет игрушку по дороге, когда участка над кубом нет', () => {
    // Путь начинается над лотком или короче порога до входа в лоток
    expect(pickFumbleShare(TRAY_CENTER, { x: 4, y: 4 }, createRandom(4))).toBeUndefined()
    expect(pickFumbleShare({ x: 2.5, y: 6.5 }, TRAY_CENTER, createRandom(4))).toBeUndefined()
  })
})

describe('клешня: отмена', () => {
  it('отменяет движение по сигналу: клешня остаётся там, где её застала отмена', async () => {
    const rig = new ClawRig()
    const abort = new AbortController()
    const motion = rig.moveTo({ x: 1, y: 7 }, abort.signal)
    const rejected = expect(motion).rejects.toMatchObject({ name: 'AbortError' })

    drive(rig, STILL, 10)

    const stopped = rig.getCartPoint()

    abort.abort()
    await rejected
    drive(rig, STILL, 30)

    expect(rig.getCartPoint()).toEqual(stopped)
  })

  it('заменяет движение новым: прежнее отклоняется, новое доходит до цели', async () => {
    const rig = new ClawRig()
    const first = rig.moveTo({ x: 1, y: 7 })
    const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' })

    drive(rig, STILL, 10)

    const second = rig.moveTo({ x: 5, y: 4 })

    await rejected
    await finish(rig, second)

    expect(rig.getCartPoint()).toMatchObject({ x: 5, y: 4 })
  })

  it('не оставляет обработчиков на сигнале автомата после завершённых и заменённых движений', async () => {
    // Сигнал автомата живёт всю игру: забытый обработчик копился бы с каждым движением
    const { signal } = new AbortController()
    const rig = new ClawRig()
    const replaced = rig.moveTo({ x: 1, y: 7 }, signal)
    const rejected = expect(replaced).rejects.toMatchObject({ name: 'AbortError' })

    await finish(rig, rig.carryTo({ x: 5, y: 4 }, undefined, signal))
    await rejected
    await finish(rig, rig.descend(2, signal))

    expect(getEventListeners(signal, 'abort')).toHaveLength(0)
  })
})
