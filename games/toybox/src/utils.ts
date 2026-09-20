import { Color, type Ticker } from 'pixi.js'

import type { Random } from '@pixi-demos/core/types'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'

import {
  AXIS_X,
  AXIS_Y,
  CLAW_ACCELERATION,
  CLAW_BRAKE_ACCELERATION,
  CLAW_BRAKE_MS,
  CLAW_MIN_SPEED,
  CLAW_RESPONSE_MS,
  DEPTH_SCALE_MIN,
  DOME_CENTER_LAYERS,
  DOME_EDGE_LAYERS,
  GRID_SIZE,
  JOYSTICK_DEADZONE,
  JOYSTICK_FULL_TILT,
  MAX_BOUNCES,
  MAX_LAYERS,
  PATH_STEP,
  SETTLE_CHANCE,
  SETTLE_GAP,
  TOY_HUE_SPREAD,
  TOY_LIGHTNESS_SPREAD,
  TRAY_BOUNCE_WEIGHT,
  TRAY_ORIGIN,
  TRAY_WALL_LAYERS,
  TRAY_SIZE,
  UNIT_HEIGHT,
} from './constants'
import type {
  CellAddress,
  DropResult,
  GroundPoint,
  ScreenPoint,
  ToySlide,
  WorldPoint,
  WorldTweenOptions,
} from './types'

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

/** Определитель осей проекции: он же множитель обратного перевода. */
const AXES_DETERMINANT = AXIS_X.x * AXIS_Y.y - AXIS_X.y * AXIS_Y.x

/**
 * Переводит точку мира в экранные дизайн-единицы. Начало координат — ближний угол пола:
 * ось `x` уходит вглубь сцены, ось `y` — вдоль фронтальной грани влево, высота `z` поднимает точку.
 */
export const worldToScreen = ({ x, y, z }: WorldPoint): ScreenPoint => ({
  x: x * AXIS_X.x + y * AXIS_Y.x,
  y: x * AXIS_X.y + y * AXIS_Y.y - z * UNIT_HEIGHT,
})

/**
 * Переводит экранный вектор в оси поля — обращение `worldToScreen` на плоскости `z` = 0.
 * По нему отклонение джойстика становится направлением хода клешни.
 */
export const screenToGround = ({ x, y }: ScreenPoint): GroundPoint => ({
  x: (x * AXIS_Y.y - y * AXIS_Y.x) / AXES_DETERMINANT,
  y: (AXIS_X.x * y - AXIS_X.y * x) / AXES_DETERMINANT,
})

/**
 * Переводит отклонение джойстика в направление хода по полю: сторону берёт из проекции, а силу —
 * из хода ручки за вычетом мёртвой зоны. Ход сверх `JOYSTICK_FULL_TILT` уже ничего не добавляет,
 * поэтому джойстик ощущается как переключатель, а не как аналоговый стик.
 */
export const toGroundDirection = (vector: ScreenPoint): GroundPoint => {
  const tilt = Math.hypot(vector.x, vector.y)

  if (tilt <= JOYSTICK_DEADZONE) return { x: 0, y: 0 }

  const ground = screenToGround(vector)
  const length = Math.hypot(ground.x, ground.y)

  if (length === 0) return { x: 0, y: 0 }

  const strength = clamp((tilt - JOYSTICK_DEADZONE) / (JOYSTICK_FULL_TILT - JOYSTICK_DEADZONE), 0, 1)

  return { x: (ground.x / length) * strength, y: (ground.y / length) * strength }
}

/**
 * Луч взгляда в осях мира: вдоль него точки проецируются в одну точку экрана.
 * Находится из условия `worldToScreen(луч) = 0`, шаг по оси `y` принят за 1.
 */
const VIEW_X = -AXIS_Y.x / AXIS_X.x
const VIEW_Z = (AXIS_X.y * VIEW_X + AXIS_Y.y) / UNIT_HEIGHT

/** Порядок наложения точки: её смещение против луча взгляда. Чем больше, тем ближе к игроку. */
export const getDepthOrder = ({ x, y, z }: WorldPoint): number => -(x * VIEW_X + y + z * VIEW_Z)

/** Масштаб предмета на глубине `x`: у дальнего края поля он мельче, чем у ближнего. */
export const getDepthScale = (x: number): number => 1 - (1 - DEPTH_SCALE_MIN) * clamp(x / GRID_SIZE, 0, 1)

/** Удерживает точку в пределах поля. */
export const clampToField = ({ x, y }: GroundPoint): GroundPoint => ({
  x: clamp(x, 0, GRID_SIZE),
  y: clamp(y, 0, GRID_SIZE),
})

/**
 * Ведёт скорость клешни к целевой за `deltaMs`. Скорость приближается к цели экспоненциально,
 * а её прирост за кадр ограничен ускорением: полное отклонение джойстика упирается в этот предел и
 * разгоняется кривой, слабое — выходит на свою небольшую цель почти сразу. Нулевая цель тормозит
 * отдельным, много большим пределом и гасит остаток скорости.
 */
export const advanceVelocity = (velocity: GroundPoint, target: GroundPoint, deltaMs: number): GroundPoint => {
  const gapX = target.x - velocity.x
  const gapY = target.y - velocity.y
  const gap = Math.hypot(gapX, gapY)

  if (gap === 0) return velocity

  const isBraking = target.x === 0 && target.y === 0
  const limit = ((isBraking ? CLAW_BRAKE_ACCELERATION : CLAW_ACCELERATION) * deltaMs) / 1000
  const responseMs = isBraking ? CLAW_BRAKE_MS : CLAW_RESPONSE_MS
  const change = Math.min(gap * (1 - Math.exp(-deltaMs / responseMs)), limit)
  const next = { x: velocity.x + (gapX / gap) * change, y: velocity.y + (gapY / gap) * change }

  return isBraking && Math.hypot(next.x, next.y) < CLAW_MIN_SPEED ? { x: 0, y: 0 } : next
}

/** Контур грани куба на высоте `z`: четыре угла в порядке обхода. */
export const getFaceOutline = (z: number): WorldPoint[] => [
  { x: 0, y: 0, z },
  { x: GRID_SIZE, y: 0, z },
  { x: GRID_SIZE, y: GRID_SIZE, z },
  { x: 0, y: GRID_SIZE, z },
]

/** Контур лотка на полу: четыре угла его квадранта в порядке обхода. */
export const getTrayOutline = (): WorldPoint[] => {
  const { col, row } = TRAY_ORIGIN

  return [
    { x: col, y: row, z: 0 },
    { x: col + TRAY_SIZE, y: row, z: 0 },
    { x: col + TRAY_SIZE, y: row + TRAY_SIZE, z: 0 },
    { x: col, y: row + TRAY_SIZE, z: 0 },
  ]
}

export const toCell = ({ x, y }: GroundPoint): CellAddress => ({
  col: clamp(Math.floor(x), 0, GRID_SIZE - 1),
  row: clamp(Math.floor(y), 0, GRID_SIZE - 1),
})

/** Центр ячейки в координатах поля. */
export const getCellCenter = ({ col, row }: CellAddress): GroundPoint => ({ x: col + 0.5, y: row + 0.5 })

/** Лежит ли ячейка в квадранте лотка. */
export const isTrayCell = ({ col, row }: CellAddress): boolean =>
  col >= TRAY_ORIGIN.col &&
  col < TRAY_ORIGIN.col + TRAY_SIZE &&
  row >= TRAY_ORIGIN.row &&
  row < TRAY_ORIGIN.row + TRAY_SIZE

/**
 * Контуры двух граней, которыми лоток отгорожен от куба. Двух других граней у него нет —
 * там лоток прилегает к стенкам самого куба.
 */
export const getTrayWallOutlines = (): WorldPoint[][] => {
  const { col, row } = TRAY_ORIGIN
  const far = col + TRAY_SIZE
  const top = TRAY_WALL_LAYERS

  return [
    [
      { x: far, y: row, z: 0 },
      { x: far, y: row + TRAY_SIZE, z: 0 },
      { x: far, y: row + TRAY_SIZE, z: top },
      { x: far, y: row, z: top },
    ],
    [
      { x: col, y: row, z: 0 },
      { x: far, y: row, z: 0 },
      { x: far, y: row, z: top },
      { x: col, y: row, z: top },
    ],
  ]
}

/** Доля пути от `from` до `to`, на которой путь проходит ближе всего к точке `at`. */
export const getPathShare = (from: GroundPoint, to: GroundPoint, at: GroundPoint): number => {
  const pathX = to.x - from.x
  const pathY = to.y - from.y
  const length = pathX * pathX + pathY * pathY

  if (length === 0) return 0

  return clamp(((at.x - from.x) * pathX + (at.y - from.y) * pathY) / length, 0, 1)
}

/** Ячейки, над которыми проходит путь между точками поля: в порядке хода и без повторов подряд. */
export const getPathCells = (from: GroundPoint, to: GroundPoint): CellAddress[] => {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  const steps = Math.max(Math.ceil(distance / PATH_STEP), 1)
  const cells: CellAddress[] = []

  for (let step = 0; step <= steps; step++) {
    const share = step / steps
    const cell = toCell({ x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share })
    const last = cells[cells.length - 1]

    if (!last || last.col !== cell.col || last.row !== cell.row) cells.push(cell)
  }

  return cells
}

/**
 * Высота стопки в ячейке на старте: куча сложена куполом — по краям поля она ниже, к центру выше.
 * Ячейки лотка остаются пустыми.
 */
export const getDomeHeight = (cell: CellAddress): number => {
  if (isTrayCell(cell)) return 0

  const { col, row } = cell
  const ring = Math.min(col, row, GRID_SIZE - 1 - col, GRID_SIZE - 1 - row)
  const peakRing = GRID_SIZE / 2 - 1

  return DOME_EDGE_LAYERS + Math.round(((DOME_CENTER_LAYERS - DOME_EDGE_LAYERS) * ring) / peakRing)
}

/** Соседи ячейки по четырём сторонам, не выходящие за поле. */
export const getNeighbours = ({ col, row }: CellAddress): CellAddress[] =>
  [
    { col: col + 1, row },
    { col: col - 1, row },
    { col, row: row + 1 },
    { col, row: row - 1 },
  ].filter(({ col: c, row: r }) => c >= 0 && c < GRID_SIZE && r >= 0 && r < GRID_SIZE)

/** Взвешенный выбор элемента: вес задаёт долю бросков, приходящихся на элемент. */
const pickWeighted = <T>(items: readonly { item: T; weight: number }[], random: Random): T => {
  const total = items.reduce((sum, { weight }) => sum + weight, 0)
  let roll = random() * total

  for (const { item, weight } of items) {
    roll -= weight

    if (roll < 0) return item
  }

  return items[items.length - 1].item
}

/** Ближайшая ячейка с местом: обход в ширину от переполненной, чтобы игрушка всегда куда-то села. */
const findFreeCell = (heights: readonly number[][], from: CellAddress): CellAddress => {
  const visited = new Set([`${from.col}:${from.row}`])
  const queue: CellAddress[] = [from]

  while (queue.length > 0) {
    const cell = queue.shift() as CellAddress

    if (!isTrayCell(cell) && heights[cell.col][cell.row] < MAX_LAYERS) return cell

    for (const next of getNeighbours(cell)) {
      const key = `${next.col}:${next.row}`

      if (visited.has(key)) continue

      visited.add(key)
      queue.push(next)
    }
  }

  return from
}

/**
 * Разыгрывает падение игрушки в ячейку `target`: пока ячейка полна, игрушка отскакивает в соседнюю,
 * выбранную броском. Лоток идёт кандидатом с пониженным весом и только для игрушки выше его стенок.
 * После `MAX_BOUNCES` место ищется обходом поля, поэтому цепочка отскоков всегда заканчивается.
 */
export const resolveDrop = (heights: readonly number[][], target: CellAddress, random: Random): DropResult => {
  const path: CellAddress[] = [target]
  let cell = target

  if (isTrayCell(cell)) return { path, layer: 0, collected: true }

  for (let bounce = 0; bounce < MAX_BOUNCES; bounce++) {
    const height = heights[cell.col][cell.row]

    if (height < MAX_LAYERS) return { path, layer: height, collected: false }

    // Игрушка отскакивает с верха переполненной ячейки: в лоток она перевалится с высоты
    // выше его стенок
    const candidates = getNeighbours(cell)
      .filter((next) => !isTrayCell(next) || height >= TRAY_WALL_LAYERS)
      .map((next) => ({ item: next, weight: isTrayCell(next) ? TRAY_BOUNCE_WEIGHT : 1 }))

    if (candidates.length === 0) break

    cell = pickWeighted(candidates, random)
    path.push(cell)

    if (isTrayCell(cell)) return { path, layer: 0, collected: true }
  }

  const free = findFreeCell(heights, cell)

  if (free.col !== cell.col || free.row !== cell.row) path.push(free)

  return { path, layer: heights[free.col][free.row], collected: false }
}

/**
 * Разыгрывает осыпание кучи: там, где соседние стопки разошлись больше чем на `SETTLE_GAP` слоёв,
 * верхняя игрушка высокой ячейки с вероятностью `SETTLE_CHANCE` сползает в низкую.
 * Высоты пересчитываются по ходу разбора, поэтому одну игрушку не уведут дважды.
 */
export const getSettleSlides = (heights: readonly number[][], random: Random): ToySlide[] => {
  const levels = heights.map((rows) => [...rows])
  const slides: ToySlide[] = []

  for (let col = 0; col < GRID_SIZE; col++) {
    for (let row = 0; row < GRID_SIZE; row++) {
      const from = { col, row }

      if (isTrayCell(from)) continue

      for (const to of getNeighbours(from)) {
        if (isTrayCell(to)) continue
        if (levels[col][row] - levels[to.col][to.row] <= SETTLE_GAP) continue
        if (random() >= SETTLE_CHANCE) continue

        levels[col][row] -= 1
        levels[to.col][to.row] += 1
        slides.push({ from, to })
      }
    }
  }

  return slides
}

/**
 * Выбирает ячейку, над которой клешня выронит игрушку по дороге из `from` в `to`.
 * Кандидаты — ячейки пути кроме стартовой и кроме лотка; `undefined` означает, что ронять негде.
 */
export const pickFumbleCell = (from: GroundPoint, to: GroundPoint, random: Random): CellAddress | undefined => {
  const candidates = getPathCells(from, to)
    .slice(1)
    .filter((cell) => !isTrayCell(cell))

  return candidates.length > 0 ? candidates[Math.floor(random() * candidates.length)] : undefined
}

/** Компоненты цвета в HSL: тон в градусах, насыщенность и светлота в долях единицы. */
const toHsl = (color: string): { h: number; s: number; l: number } => {
  const { r, g, b } = new Color(color).toRgb()
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const span = max - min
  const l = (max + min) / 2

  if (span === 0) return { h: 0, s: 0, l }

  const s = span / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / span) % 6 : max === g ? (b - r) / span + 2 : (r - g) / span + 4

  return { h: (((h * 60) % 360) + 360) % 360, s, l }
}

/** Цвет игрушки: корневой цвет со случайным сдвигом тона и светлоты. */
export const shiftColor = (base: string, random: Random): number => {
  const { h, s, l } = toHsl(base)
  const hue = (((h + (random() * 2 - 1) * TOY_HUE_SPREAD) % 360) + 360) % 360
  const lightness = clamp(l + (random() * 2 - 1) * TOY_LIGHTNESS_SPREAD, 0.2, 0.8)

  return new Color({ h: hue, s: s * 100, l: lightness * 100 }).toNumber()
}

const interpolate = (from: WorldPoint, to: WorldPoint, progress: number): WorldPoint => ({
  x: from.x + (to.x - from.x) * progress,
  y: from.y + (to.y - from.y) * progress,
  z: from.z + (to.z - from.z) * progress,
})

/**
 * Ведёт точку мира от `from` к `to` за `durationMs` на игровом тикере, отдавая её каждый кадр
 * в `apply`. Промис резолвится на последнем кадре, реджектится по `signal`.
 * При `prefers-reduced-motion` точка выставляется сразу.
 */
export const tweenWorld = (
  ticker: GameTicker,
  { from, to, durationMs, ease, apply }: WorldTweenOptions,
  signal?: AbortSignal
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason as Error)

      return
    }

    let elapsed = 0

    const settle = (finish: () => void) => {
      ticker.remove(step)
      signal?.removeEventListener('abort', handleAbort)

      finish()
    }

    const step = (frameTicker: Ticker) => {
      elapsed += frameTicker.deltaMS

      const progress = Math.min(elapsed / durationMs, 1)

      apply(interpolate(from, to, ease(progress)))

      if (progress === 1) settle(resolve)
    }

    const handleAbort = () => settle(() => reject(signal?.reason as Error))

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      apply(to)
      resolve()

      return
    }

    signal?.addEventListener('abort', handleAbort, { once: true })
    ticker.add(step)
  })
