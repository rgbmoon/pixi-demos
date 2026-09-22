import {
  CABINET_BOTTOM_Z,
  CABINET_FRONT_HORIZONTAL,
  CABINET_FRONT_VERTICAL,
  CABINET_FRONT_X,
  CABINET_TOP_Z,
  BUTTON_SIZE_UNITS,
  CELL_SIZE,
  CONTROL_OUTLINE_STEPS,
  CONTROL_PANEL_HORIZONTAL,
  CONTROL_PANEL_VERTICAL,
  CUBE_HEIGHT,
  DROP_BUTTON_CENTER,
  GRID_SIZE,
  JOYSTICK_CENTER,
  JOYSTICK_RADIUS,
  MARQUEE_TOP_Z,
  PIXEL_SCALE,
  PRIZE_HATCH_SIZE,
  PRIZE_HATCH_CENTER,
  RESET_BUTTON_CENTER,
  RESET_BUTTON_SIZE_UNITS,
} from '#src/constants'
import type { ScreenBounds, ScreenPoint, WorldPlane, WorldPoint } from '#src/types'

import { worldToScreen } from './projection'

// TODO у нас уже есть правила projection. Я не уверен что весь этот код не лишний для формирования геометрии машины

/** Плоскость наклонной панели управления. */
export const CONTROL_PANEL_PLANE: WorldPlane = {
  horizontal: CONTROL_PANEL_HORIZONTAL,
  vertical: CONTROL_PANEL_VERTICAL,
}

/** Передняя вертикальная плоскость тумбы и табло. */
export const CABINET_FRONT_PLANE: WorldPlane = {
  horizontal: CABINET_FRONT_HORIZONTAL,
  vertical: CABINET_FRONT_VERTICAL,
}

/** Округляет статическую геометрию к пиксельной сетке рабочего арта. */
export const snapScreenPoint = ({ x, y }: ScreenPoint): ScreenPoint => ({
  x: Math.round(x / PIXEL_SCALE) * PIXEL_SCALE,
  y: Math.round(y / PIXEL_SCALE) * PIXEL_SCALE,
})

/** Проецирует статический контур и привязывает каждую вершину к пиксельной сетке. */
export const projectWorldOutline = (points: readonly WorldPoint[]): ScreenPoint[] =>
  points.map((point) => snapScreenPoint(worldToScreen(point)))

/** Экранное смещение точки в локальных координатах заданной мировой плоскости. */
export const projectPlaneOffset = (
  plane: WorldPlane,
  horizontal: number,
  vertical: number,
  snap = false
): ScreenPoint => {
  const horizontalScale = horizontal / CELL_SIZE
  const verticalScale = vertical / CELL_SIZE
  const point = worldToScreen({
    x: plane.horizontal.x * horizontalScale + plane.vertical.x * verticalScale,
    y: plane.horizontal.y * horizontalScale + plane.vertical.y * verticalScale,
    z: plane.horizontal.z * horizontalScale + plane.vertical.z * verticalScale,
  })

  return snap ? snapScreenPoint(point) : point
}

/** Возвращает локальные координаты экранного смещения в мировой плоскости. */
export const screenToPlaneOffset = (plane: WorldPlane, point: ScreenPoint): ScreenPoint => {
  const horizontal = projectPlaneOffset(plane, CELL_SIZE, 0)
  const vertical = projectPlaneOffset(plane, 0, CELL_SIZE)
  const determinant = horizontal.x * vertical.y - horizontal.y * vertical.x

  return {
    x: ((point.x * vertical.y - point.y * vertical.x) / determinant) * CELL_SIZE,
    y: ((horizontal.x * point.y - horizontal.y * point.x) / determinant) * CELL_SIZE,
  }
}

/** Проецирует окружность, заданную в локальных координатах мировой плоскости. */
export const getProjectedPlaneCircle = (
  plane: WorldPlane,
  radius: number,
  steps = CONTROL_OUTLINE_STEPS
): ScreenPoint[] =>
  Array.from({ length: steps }, (_, step) => {
    const angle = (2 * Math.PI * step) / steps

    return projectPlaneOffset(plane, Math.cos(angle) * radius, Math.sin(angle) * radius, true)
  })

/** Проецирует дугу, включая обе её крайние точки. */
export const getProjectedPlaneArc = (
  plane: WorldPlane,
  radius: number,
  start: number,
  end: number,
  steps = CONTROL_OUTLINE_STEPS
): ScreenPoint[] =>
  Array.from({ length: steps + 1 }, (_, step) => {
    const angle = start + ((end - start) * step) / steps

    return projectPlaneOffset(plane, Math.cos(angle) * radius, Math.sin(angle) * radius, true)
  })

/** Прямоугольник с центром в начале координат мировой плоскости. */
export const getProjectedPlaneRectangle = (plane: WorldPlane, width: number, height: number): ScreenPoint[] => {
  const halfWidth = width / 2
  const halfHeight = height / 2

  return [
    projectPlaneOffset(plane, -halfWidth, -halfHeight, true),
    projectPlaneOffset(plane, halfWidth, -halfHeight, true),
    projectPlaneOffset(plane, halfWidth, halfHeight, true),
    projectPlaneOffset(plane, -halfWidth, halfHeight, true),
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

/** Силуэт стеклянного объёма, которым ограничивается падающая в шахту игрушка. */
export const getGlassMaskOutline = (): WorldPoint[] => [
  { x: 0, y: 0, z: 0 },
  { x: GRID_SIZE, y: 0, z: 0 },
  { x: GRID_SIZE, y: 0, z: CUBE_HEIGHT },
  { x: GRID_SIZE, y: GRID_SIZE, z: CUBE_HEIGHT },
  { x: 0, y: GRID_SIZE, z: CUBE_HEIGHT },
  { x: 0, y: GRID_SIZE, z: 0 },
]

/** Контур окна выдачи относительно его центра на передней грани. */
export const getPrizeHatchOutline = (): ScreenPoint[] =>
  getProjectedPlaneRectangle(CABINET_FRONT_PLANE, PRIZE_HATCH_SIZE, PRIZE_HATCH_SIZE)

/** Границы автомата из тех же мировых вершин, которыми рисуются его грани. */
export const getMachineBounds = (): ScreenBounds => {
  const placeOutline = (center: WorldPoint, outline: readonly ScreenPoint[]): ScreenPoint[] => {
    const position = snapScreenPoint(worldToScreen(center))

    return outline.map(({ x, y }) => ({ x: position.x + x, y: position.y + y }))
  }
  const points = [
    ...getCabinetOutlines().flatMap(projectWorldOutline),
    ...getMarqueeOutlines().flatMap(projectWorldOutline),
    ...placeOutline(JOYSTICK_CENTER, getProjectedPlaneCircle(CONTROL_PANEL_PLANE, JOYSTICK_RADIUS)),
    ...placeOutline(DROP_BUTTON_CENTER, getProjectedPlaneCircle(CONTROL_PANEL_PLANE, BUTTON_SIZE_UNITS / 2)),
    ...placeOutline(PRIZE_HATCH_CENTER, getPrizeHatchOutline()),
    ...placeOutline(RESET_BUTTON_CENTER, getProjectedPlaneCircle(CABINET_FRONT_PLANE, RESET_BUTTON_SIZE_UNITS / 2)),
  ]
  const xs = points.map(({ x }) => x)
  const ys = points.map(({ y }) => y)
  const left = Math.min(...xs)
  const right = Math.max(...xs)
  const top = Math.min(...ys)
  const bottom = Math.max(...ys)

  return { left, right, top, bottom, width: right - left, height: bottom - top }
}
