import { FUMBLE_START_CLEARANCE, GRID_SIZE, TRAY_ORIGIN, TRAY_SIZE, TRAY_WALL_HEIGHT } from '#src/constants'
import type { GroundPoint, WorldPoint } from '#src/types'
import type { Random } from '@pixi-demos/core/types'

import { clamp } from './math'

/**
 * Удерживает точку в пределах поля.
 */
export const clampToField = ({ x, y }: GroundPoint, margin = 0): GroundPoint => ({
  x: clamp(x, margin, GRID_SIZE - margin),
  y: clamp(y, margin, GRID_SIZE - margin),
})

/** Лежит ли точка пола над лотком. */
export const isOverTray = ({ x, y }: GroundPoint): boolean =>
  x >= TRAY_ORIGIN.x && x <= TRAY_ORIGIN.x + TRAY_SIZE && y >= TRAY_ORIGIN.y && y <= TRAY_ORIGIN.y + TRAY_SIZE

/** Контур грани куба на высоте `z`: четыре угла в порядке обхода. */
export const getFaceOutline = (z: number): WorldPoint[] => [
  { x: 0, y: 0, z },
  { x: GRID_SIZE, y: 0, z },
  { x: GRID_SIZE, y: GRID_SIZE, z },
  { x: 0, y: GRID_SIZE, z },
]

/** Контур лотка на полу: четыре угла его квадранта в порядке обхода. */
export const getTrayOutline = (): WorldPoint[] => {
  const { x, y } = TRAY_ORIGIN

  return [
    { x, y, z: 0 },
    { x: x + TRAY_SIZE, y, z: 0 },
    { x: x + TRAY_SIZE, y: y + TRAY_SIZE, z: 0 },
    { x, y: y + TRAY_SIZE, z: 0 },
  ]
}

/**
 * Контуры двух граней, которыми лоток отгорожен от куба. Двух других граней у него нет —
 * там лоток прилегает к стенкам самого куба.
 */
export const getTrayWallOutlines = (): WorldPoint[][] => {
  const { x, y } = TRAY_ORIGIN
  const far = x + TRAY_SIZE
  const top = TRAY_WALL_HEIGHT

  return [
    [
      { x: far, y, z: 0 },
      { x: far, y: y + TRAY_SIZE, z: 0 },
      { x: far, y: y + TRAY_SIZE, z: top },
      { x: far, y, z: top },
    ],
    [
      { x, y, z: 0 },
      { x: far, y, z: 0 },
      { x: far, y, z: top },
      { x, y, z: top },
    ],
  ]
}

/** Доля пути от `from` к `to`, на которой путь входит в лоток: 0 — путь начинается над лотком, 1 — не входит в него. */
const getTrayEntryShare = (from: GroundPoint, to: GroundPoint): number => {
  let enter = 0
  let exit = 1

  for (const axis of ['x', 'y'] as const) {
    const distance = to[axis] - from[axis]
    const low = TRAY_ORIGIN[axis]
    const high = TRAY_ORIGIN[axis] + TRAY_SIZE

    if (distance === 0) {
      if (from[axis] < low || from[axis] > high) return 1
      continue
    }

    const first = (low - from[axis]) / distance
    const second = (high - from[axis]) / distance

    enter = Math.max(enter, Math.min(first, second))
    exit = Math.min(exit, Math.max(first, second))
  }

  return enter <= exit ? enter : 1
}

/**
 * Доля пути клешни от `from` к `to`, на которой она роняет игрушку: равномерно по длине участка, который
 * начинается дальше `FUMBLE_START_CLEARANCE` от места захвата и заканчивается на входе в лоток. Без такого
 * участка — `undefined`.
 */
export const pickFumbleShare = (from: GroundPoint, to: GroundPoint, random: Random): number | undefined => {
  const length = Math.hypot(to.x - from.x, to.y - from.y)

  if (length === 0) return undefined

  const start = FUMBLE_START_CLEARANCE / length
  const end = getTrayEntryShare(from, to)

  return end > start ? start + random() * (end - start) : undefined
}
