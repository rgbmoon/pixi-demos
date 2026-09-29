import {
  ART_CELL,
  ART_PIXEL,
  CABINET_BOTTOM_Z,
  CABINET_FRONT_PLANE,
  CABINET_FRONT_X,
  CABINET_TOP_Z,
  CUBE_HEIGHT,
  GRID_SIZE,
  MACHINE_CANVAS_SHARE,
  MACHINE_MARGIN,
  MARQUEE_LAMP_COUNT,
  MARQUEE_SCREEN_HEIGHT,
  MARQUEE_SCREEN_SIDE,
  MARQUEE_SCREEN_TOP,
  MARQUEE_TOP_Z,
  PILLAR_WIDTH,
  PRIZE_HATCH_SIZE,
  RESET_PLATE_WIDTH,
  TRAY_ORIGIN,
  TRAY_SIZE,
  TRAY_WALL_HEIGHT,
} from '#src/constants'
import type { FaceCorners, GroundPoint, MachineLayout, ScreenPoint, ScreenRect, WorldPoint } from '#src/types'

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

/**
 * Вписывает корпус с отступом `MACHINE_MARGIN` в долю `MACHINE_CANVAS_SHARE` области `width × height` и центрирует.
 * Пиксель арта занимает целое число пикселей рендера, позиция кратна пикселю рендера: иначе пиксели арта
 * получают разную ширину.
 */
export const getMachineLayout = (width: number, height: number, resolution: number): MachineLayout => {
  const { left, right, top, bottom } = getMachineBounds()
  const fitted =
    MACHINE_CANVAS_SHARE *
    Math.min(width / (right - left + 2 * MACHINE_MARGIN), height / (bottom - top + 2 * MACHINE_MARGIN))
  // Пикселей рендера на пиксель арта: не меньше одного, даже если автомат не помещается
  const renderPixels = Math.max(1, Math.floor(fitted * ART_PIXEL * resolution))
  const scale = renderPixels / (ART_PIXEL * resolution)

  return {
    scale,
    x: Math.round((width / 2 - ((left + right) / 2) * scale) * resolution) / resolution,
    y: Math.round((height / 2 - ((top + bottom) / 2) * scale) * resolution) / resolution,
  }
}

/** Ширина экрана табло, px арта: между левым краем табло и плашкой кнопки сброса с отступами по бокам. */
const getMarqueeScreenWidth = (): number => (GRID_SIZE - RESET_PLATE_WIDTH) * ART_CELL - 2 * MARQUEE_SCREEN_SIDE

/**
 * Грани корпуса и табло: углы рисунка каждой грани в мире. Боковина тумбы начинается от высоты пола бокса: её угол
 * над наклоном панели закрывает панель. В грань экрана табло входит строка тени под его рамой.
 */
export const getCabinetFaces = () => {
  const screenLeft = GRID_SIZE - MARQUEE_SCREEN_SIDE / ART_CELL
  const screenTop = MARQUEE_TOP_Z - MARQUEE_SCREEN_TOP / ART_CELL
  const screenBottom = screenTop - (MARQUEE_SCREEN_HEIGHT + 1) / ART_CELL

  return {
    cabinetFront: {
      origin: { x: CABINET_FRONT_X, y: GRID_SIZE, z: CABINET_TOP_Z },
      right: { x: CABINET_FRONT_X, y: 0, z: CABINET_TOP_Z },
      down: { x: CABINET_FRONT_X, y: GRID_SIZE, z: CABINET_BOTTOM_Z },
    },
    cabinetSide: {
      origin: { x: CABINET_FRONT_X, y: 0, z: 0 },
      right: { x: GRID_SIZE, y: 0, z: 0 },
      down: { x: CABINET_FRONT_X, y: 0, z: CABINET_BOTTOM_Z },
    },
    panel: {
      origin: { x: 0, y: GRID_SIZE, z: 0 },
      right: { x: 0, y: 0, z: 0 },
      down: { x: CABINET_FRONT_X, y: GRID_SIZE, z: CABINET_TOP_Z },
    },
    marqueeFront: {
      origin: { x: 0, y: GRID_SIZE, z: MARQUEE_TOP_Z },
      right: { x: 0, y: 0, z: MARQUEE_TOP_Z },
      down: { x: 0, y: GRID_SIZE, z: CUBE_HEIGHT },
    },
    marqueeScreen: {
      origin: { x: 0, y: screenLeft, z: screenTop },
      right: { x: 0, y: screenLeft - getMarqueeScreenWidth() / ART_CELL, z: screenTop },
      down: { x: 0, y: screenLeft, z: screenBottom },
    },
    marqueeSide: {
      origin: { x: 0, y: 0, z: MARQUEE_TOP_Z },
      right: { x: GRID_SIZE, y: 0, z: MARQUEE_TOP_Z },
      down: { x: 0, y: 0, z: CUBE_HEIGHT },
    },
    marqueeRoof: {
      origin: { x: GRID_SIZE, y: GRID_SIZE, z: MARQUEE_TOP_Z },
      right: { x: GRID_SIZE, y: 0, z: MARQUEE_TOP_Z },
      down: { x: 0, y: GRID_SIZE, z: MARQUEE_TOP_Z },
    },
  } as const satisfies Record<string, FaceCorners>
}

/** Передние грани четырёх стоек куба: полосы шириной PILLAR_WIDTH от углов внутрь силуэта куба. */
export const getPillarFaces = () => {
  const inset = PILLAR_WIDTH / ART_CELL
  const post = (x: number, left: number, right: number): FaceCorners => ({
    origin: { x, y: left, z: CUBE_HEIGHT },
    right: { x, y: right, z: CUBE_HEIGHT },
    down: { x, y: left, z: 0 },
  })

  return {
    frontLeft: post(0, GRID_SIZE, GRID_SIZE - inset),
    frontRight: post(0, inset, 0),
    backLeft: post(GRID_SIZE, GRID_SIZE, GRID_SIZE - inset),
    backRight: post(GRID_SIZE, inset, 0),
  } as const satisfies Record<string, FaceCorners>
}

/** Центры гнёзд ламп под экраном табло, px арта от левого края табло: гнёзда делят ширину экрана поровну. */
export const getMarqueeLampCenters = (): number[] =>
  Array.from(
    { length: MARQUEE_LAMP_COUNT },
    (_, index) => MARQUEE_SCREEN_SIDE + ((index + 0.5) * getMarqueeScreenWidth()) / MARQUEE_LAMP_COUNT
  )
