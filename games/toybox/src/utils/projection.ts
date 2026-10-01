import {
  ART_PIXEL,
  AXIS_X,
  AXIS_Y,
  CELL_SIZE,
  CONTROL_OUTLINE_STEPS,
  JOYSTICK_DEADZONE,
  UNIT_HEIGHT,
} from '#src/constants'
import type {
  FaceCorners,
  FaceMatrix,
  FrameSize,
  GroundPoint,
  ScreenPoint,
  WorldPlane,
  WorldPoint,
} from '#src/types'

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

/**
 * Экранное смещение точки, поднятой над мировой плоскостью на `length` единиц сцены по нормали. Нормаль смотрит на
 * игрока: у панели — вверх, у фасада — вперёд.
 */
export const projectPlaneNormal = ({ horizontal, vertical }: WorldPlane, length: number): ScreenPoint => {
  const normal = {
    x: vertical.y * horizontal.z - vertical.z * horizontal.y,
    y: vertical.z * horizontal.x - vertical.x * horizontal.z,
    z: vertical.x * horizontal.y - vertical.y * horizontal.x,
  }
  const scale = length / CELL_SIZE / Math.hypot(normal.x, normal.y, normal.z)

  return worldToScreen({ x: normal.x * scale, y: normal.y * scale, z: normal.z * scale })
}

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

/** Размер кадра грани в пикселях арта: экранный сдвиг верхнего края по горизонтали и левого края по вертикали. */
export const getFaceSize = ({ origin, right, down }: FaceCorners): FrameSize => {
  const start = worldToScreen(origin)

  return {
    width: Math.round(Math.abs(worldToScreen(right).x - start.x) / ART_PIXEL),
    height: Math.round(Math.abs(worldToScreen(down).y - start.y) / ART_PIXEL),
  }
}

/**
 * Матрица кадра грани: пиксель плоского кадра переходит на грань в мире. Наклон плоскости применяется при рендере,
 * поэтому ступень наклонной границы равна пикселю рендера.
 */
export const getFaceMatrix = ({ origin, right, down }: FaceCorners, { width, height }: FrameSize): FaceMatrix => {
  const start = worldToScreen(origin)
  const end = worldToScreen(right)
  const bottom = worldToScreen(down)

  return {
    a: (end.x - start.x) / width,
    b: (end.y - start.y) / width,
    c: (bottom.x - start.x) / height,
    d: (bottom.y - start.y) / height,
    tx: start.x,
    ty: start.y,
  }
}

/** Четыре угла грани в мире в порядке обхода: четвёртый угол достраивается по трём заданным. */
export const getFaceQuad = ({ origin, right, down }: FaceCorners): WorldPoint[] => [
  origin,
  right,
  { x: right.x + down.x - origin.x, y: right.y + down.y - origin.y, z: right.z + down.z - origin.z },
  down,
]
