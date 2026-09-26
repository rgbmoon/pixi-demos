import {
  ART_PIXEL,
  AXIS_X,
  AXIS_Y,
  CELL_SIZE,
  CONTROL_OUTLINE_STEPS,
  JOYSTICK_DEADZONE,
  UNIT_HEIGHT,
} from '#src/constants'
import type { GroundPoint, PlaneShear, ScreenPoint, WorldPlane, WorldPoint } from '#src/types'

/** Определитель осей проекции: он же множитель обратного перевода. */
const AXES_DETERMINANT = AXIS_X.x * AXIS_Y.y - AXIS_X.y * AXIS_Y.x

/**
 * Переводит точку мира в экранные единицы сцены. Начало координат — ближний угол пола:
 * ось `x` уходит вглубь сцены, ось `y` — вдоль фронтальной грани влево, высота `z` поднимает точку.
 */
export const worldToScreen = ({ x, y, z }: WorldPoint): ScreenPoint => ({
  x: x * AXIS_X.x + y * AXIS_Y.x,
  y: x * AXIS_X.y + y * AXIS_Y.y - z * UNIT_HEIGHT,
})

/** Округляет экранную точку до пикселя арта: пиксели движущегося объекта совпадают с сеткой пикселей корпуса. */
export const snapToArtPixel = ({ x, y }: ScreenPoint): ScreenPoint => ({
  x: Math.round(x / ART_PIXEL) * ART_PIXEL,
  y: Math.round(y / ART_PIXEL) * ART_PIXEL,
})

/**
 * Переводит экранный вектор в оси поля — обращение `worldToScreen` на плоскости `z` = 0.
 * По нему отклонение джойстика становится направлением хода клешни.
 */
export const screenToGround = ({ x, y }: ScreenPoint): GroundPoint => ({
  x: (x * AXIS_Y.y - y * AXIS_Y.x) / AXES_DETERMINANT,
  y: (AXIS_X.x * y - AXIS_X.y * x) / AXES_DETERMINANT,
})

/** После мёртвой зоны возвращает единичное направление по полю, внутри неё — нулевой вектор. */
export const toGroundDirection = (vector: ScreenPoint): GroundPoint => {
  const tilt = Math.hypot(vector.x, vector.y)

  if (tilt <= JOYSTICK_DEADZONE) return { x: 0, y: 0 }

  const ground = screenToGround(vector)
  const length = Math.hypot(ground.x, ground.y)

  if (length === 0) return { x: 0, y: 0 }

  return { x: ground.x / length, y: ground.y / length }
}

/**
 * Луч взгляда в осях мира: вдоль него точки проецируются в одну точку экрана.
 * Находится из условия `worldToScreen(луч) = 0`, шаг по оси `y` принят за 1.
 */
const VIEW_X = -AXIS_Y.x / AXIS_X.x
const VIEW_Z = (AXIS_X.y * VIEW_X + AXIS_Y.y) / UNIT_HEIGHT

/** Порядок наложения точки: её смещение против луча взгляда. Чем больше, тем ближе к игроку. */
export const getDepthOrder = ({ x, y, z }: WorldPoint): number => -(x * VIEW_X + y + z * VIEW_Z)

/** Луч взгляда в осях мира: при движении вдоль него точка удаляется от игрока. */
export const getViewRay = (): WorldPoint => ({ x: VIEW_X, y: 1, z: VIEW_Z })

/** Экранное смещение точки в локальных координатах заданной мировой плоскости. */
export const projectPlaneOffset = (plane: WorldPlane, horizontal: number, vertical: number): ScreenPoint => {
  const horizontalScale = horizontal / CELL_SIZE
  const verticalScale = vertical / CELL_SIZE

  return worldToScreen({
    x: plane.horizontal.x * horizontalScale + plane.vertical.x * verticalScale,
    y: plane.horizontal.y * horizontalScale + plane.vertical.y * verticalScale,
    z: plane.horizontal.z * horizontalScale + plane.vertical.z * verticalScale,
  })
}

/**
 * Наклон растра плоскости: рисунок грани рисуется прямоугольным, а в проекции игры его столбцы и строки сдвигаются
 * на эти доли пикселя за пиксель. По нему сборка ассетов переводит рисунок грани в проекцию.
 */
export const getPlaneShear = (plane: WorldPlane): PlaneShear => {
  const horizontal = projectPlaneOffset(plane, CELL_SIZE, 0)
  const vertical = projectPlaneOffset(plane, 0, CELL_SIZE)

  return { column: horizontal.y / horizontal.x, row: vertical.x / vertical.y }
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

    return projectPlaneOffset(plane, Math.cos(angle) * radius, Math.sin(angle) * radius)
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

    return projectPlaneOffset(plane, Math.cos(angle) * radius, Math.sin(angle) * radius)
  })

/** Прямоугольник с центром в начале координат мировой плоскости. */
export const getProjectedPlaneRectangle = (plane: WorldPlane, width: number, height: number): ScreenPoint[] => {
  const halfWidth = width / 2
  const halfHeight = height / 2

  return [
    projectPlaneOffset(plane, -halfWidth, -halfHeight),
    projectPlaneOffset(plane, halfWidth, -halfHeight),
    projectPlaneOffset(plane, halfWidth, halfHeight),
    projectPlaneOffset(plane, -halfWidth, halfHeight),
  ]
}
