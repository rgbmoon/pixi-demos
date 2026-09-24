import {
  CABINET_BOTTOM_Z,
  CABINET_FRONT_PLANE,
  CABINET_FRONT_X,
  CABINET_TOP_Z,
  CUBE_HEIGHT,
  GRID_SIZE,
  MACHINE_MARGIN,
  MARQUEE_TOP_Z,
  PRIZE_HATCH_SIZE,
  TRAY_ORIGIN,
  TRAY_SIZE,
  TRAY_WALL_HEIGHT,
} from '#src/constants'
import type { GroundPoint, MachineLayout, ScreenPoint, ScreenRect, WorldPoint } from '#src/types'

import { getBounds } from './geometry'
import { clamp } from './math'
import { getProjectedPlaneRectangle, worldToScreen } from './projection'

/**
 * Удерживает точку в пределах поля.
 */
export const clampToField = ({ x, y }: GroundPoint, margin = 0): GroundPoint => ({
  x: clamp(x, margin, GRID_SIZE - margin),
  y: clamp(y, margin, GRID_SIZE - margin),
})

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

/** Контуры наклонной панели, передней грани и правой боковины тумбы. */
export const getCabinetOutlines = (): WorldPoint[][] => [
  [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: GRID_SIZE, z: 0 },
    { x: CABINET_FRONT_X, y: GRID_SIZE, z: CABINET_TOP_Z },
    { x: CABINET_FRONT_X, y: 0, z: CABINET_TOP_Z },
  ],
  [
    { x: CABINET_FRONT_X, y: 0, z: CABINET_TOP_Z },
    { x: CABINET_FRONT_X, y: GRID_SIZE, z: CABINET_TOP_Z },
    { x: CABINET_FRONT_X, y: GRID_SIZE, z: CABINET_BOTTOM_Z },
    { x: CABINET_FRONT_X, y: 0, z: CABINET_BOTTOM_Z },
  ],
  [
    { x: CABINET_FRONT_X, y: 0, z: CABINET_TOP_Z },
    { x: 0, y: 0, z: 0 },
    { x: GRID_SIZE, y: 0, z: 0 },
    { x: GRID_SIZE, y: 0, z: CABINET_BOTTOM_Z },
    { x: CABINET_FRONT_X, y: 0, z: CABINET_BOTTOM_Z },
  ],
]

/** Контуры всех стенок и крыши табло. */
export const getMarqueeOutlines = (): WorldPoint[][] => [
  [
    { x: GRID_SIZE, y: 0, z: CUBE_HEIGHT },
    { x: GRID_SIZE, y: GRID_SIZE, z: CUBE_HEIGHT },
    { x: GRID_SIZE, y: GRID_SIZE, z: MARQUEE_TOP_Z },
    { x: GRID_SIZE, y: 0, z: MARQUEE_TOP_Z },
  ],
  [
    { x: 0, y: 0, z: CUBE_HEIGHT },
    { x: 0, y: GRID_SIZE, z: CUBE_HEIGHT },
    { x: 0, y: GRID_SIZE, z: MARQUEE_TOP_Z },
    { x: 0, y: 0, z: MARQUEE_TOP_Z },
  ],
  [
    { x: 0, y: 0, z: CUBE_HEIGHT },
    { x: GRID_SIZE, y: 0, z: CUBE_HEIGHT },
    { x: GRID_SIZE, y: 0, z: MARQUEE_TOP_Z },
    { x: 0, y: 0, z: MARQUEE_TOP_Z },
  ],
  [
    { x: 0, y: GRID_SIZE, z: CUBE_HEIGHT },
    { x: GRID_SIZE, y: GRID_SIZE, z: CUBE_HEIGHT },
    { x: GRID_SIZE, y: GRID_SIZE, z: MARQUEE_TOP_Z },
    { x: 0, y: GRID_SIZE, z: MARQUEE_TOP_Z },
  ],
  [
    { x: 0, y: 0, z: MARQUEE_TOP_Z },
    { x: GRID_SIZE, y: 0, z: MARQUEE_TOP_Z },
    { x: GRID_SIZE, y: GRID_SIZE, z: MARQUEE_TOP_Z },
    { x: 0, y: GRID_SIZE, z: MARQUEE_TOP_Z },
  ],
]

/** Контур окна выдачи относительно его центра на передней грани. */
export const getPrizeHatchOutline = (): ScreenPoint[] =>
  getProjectedPlaneRectangle(CABINET_FRONT_PLANE, PRIZE_HATCH_SIZE, PRIZE_HATCH_SIZE)

/** Экранные границы автомата по контурам тумбы и табло; стеклянный бокс и органы управления лежат внутри них. */
export const getMachineBounds = (): ScreenRect =>
  getBounds([...getCabinetOutlines(), ...getMarqueeOutlines()].flat().map((point) => worldToScreen(point)))

/** Вписывает корпус в область `width × height` одним масштабом с отступом `MACHINE_MARGIN` и центрирует его. */
export const getMachineLayout = (width: number, height: number): MachineLayout => {
  const { left, right, top, bottom } = getMachineBounds()
  const scale = Math.min(width / (right - left + 2 * MACHINE_MARGIN), height / (bottom - top + 2 * MACHINE_MARGIN))

  return {
    scale,
    x: width / 2 - ((left + right) / 2) * scale,
    y: height / 2 - ((top + bottom) / 2) * scale,
  }
}

/** Пропорции корпуса вместе с отступом: по ним хост строит канвас шире `CANVAS_FILL_MAX_WIDTH`. */
export const getMachineAspectRatio = (): number => {
  const { left, right, top, bottom } = getMachineBounds()

  return (right - left + 2 * MACHINE_MARGIN) / (bottom - top + 2 * MACHINE_MARGIN)
}
