export const PhaseName = {
  booting: 'booting',
  idle: 'idle',
  descending: 'descending',
  grabbing: 'grabbing',
  ascending: 'ascending',
  delivering: 'delivering',
  releasing: 'releasing',
  presenting: 'presenting',
  returning: 'returning',
} as const

export type PhaseName = (typeof PhaseName)[keyof typeof PhaseName]

/** Точка мира: `x` и `y` — оси сетки в ячейках, `z` — высота над полом. */
export type WorldPoint = {
  x: number
  y: number
  z: number
}

/** Точка или вектор в плоскости пола, в ячейках: положение клешни, её скорость, направление хода. */
export type GroundPoint = {
  x: number
  y: number
}

/** Точка или вектор плоскости для геометрических расчётов: к нему приводятся точки экрана и сечения. */
export type PlaneVector = {
  x: number
  y: number
}

/** Точка экрана в единицах сцены. */
export type ScreenPoint = {
  x: number
  y: number
}

/** Два мировых направления плоскости для её локальных осей вправо и вниз. */
export type WorldPlane = {
  readonly horizontal: WorldPoint
  readonly vertical: WorldPoint
}

/**
 * Наклон растра плоскости в проекции: сдвиг столбца по вертикали на пиксель ширины и строки по горизонтали
 * на пиксель высоты.
 */
export type PlaneShear = {
  readonly column: number
  readonly row: number
}

/** Масштаб и начало координат корпуса на канвасе. */
export type MachineLayout = {
  readonly scale: number
  readonly x: number
  readonly y: number
}

/** Действие на заданной доле перемещения после обновления точки захвата. */
export type ClawDrop = {
  share: number
  onDrop: (grip: WorldPoint) => void
}

/**
 * Идентификатор игрушки. Уникален на всё время жизни модели кучи, включая повторные наполнения: рендер
 * держит по нему View-компоненты, и повторно выданный id подменил бы новой игрушке чужой силуэт.
 */
export type ToyId = number

export type ShapeKey = 'single' | 'bar2' | 'square4' | 'cube8' | 'triangle'

/** Внешний вид выданной игрушки без её положения в куче. */
export type ToyAppearance = {
  readonly shape: ShapeKey
  readonly color: number
}

/** Точка плоскости сечения: `y` — ось поля вдоль фронтальной грани, `z` — высота. */
export type SectionPoint = {
  y: number
  z: number
}

/** Положение формы: выпуклое сечение в плоскости `(y, z)` и глубина в срезах. */
export type ShapeVariant = {
  /** Вершины выпуклого многоугольника сечения в клетках, против часовой стрелки. */
  readonly section: readonly SectionPoint[]
  /** Радиус скругления углов сечения в клетках. */
  readonly radius: number
  readonly depth: number
}

/** Форма игрушки: её положения, вес в клетках и то, как часто она попадается при наполнении. */
export type Shape = {
  readonly variants: readonly ShapeVariant[]
  readonly weight: number
  readonly fillWeight: number
}

/** Центр игрушки в плоскости сечения и её крен в радианах. */
export type ToyPose = {
  y: number
  z: number
  angle: number
}

/** Игрушка в снимке: форма, срезы и поза покоя. */
export type HeapSnapshotBody = {
  shape: ShapeKey
  variant: number
  slab: number
  y: number
  z: number
  angle: number
  color: number
}

/** Снимок кучи для хранилища: позы покоя без скоростей. */
export type HeapSnapshot = {
  version: number
  collected: number
  bodies: HeapSnapshotBody[]
}

/**
 * Предмет слоя содержимого для сортировки наложения: диапазон глубины, выпуклое сечение и экранный
 * силуэт. Сечение хранится фигурой плоскости: `x` — мировая `y`, `y` — высота. Сечение из точки или
 * отрезка тоже допустимо.
 */
export type DepthItem = {
  readonly near: number
  readonly far: number
  readonly section: readonly PlaneVector[]
  readonly outline: readonly ScreenPoint[]
  /** Оси проверки сечения и силуэта и рамка силуэта: считаются один раз при создании предмета. */
  readonly sectionAxes: readonly PlaneVector[]
  readonly outlineAxes: readonly PlaneVector[]
  readonly bounds: ScreenRect
  /** Запасной ключ порядка: по нему идёт очередь сортировки и разрываются циклы. */
  readonly key: number
}

/** Рамка на экране, выровненная по осям. */
export type ScreenRect = {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
}

/** Имя кнопки в слое доступности и действие по нажатию. */
export type ButtonOptions = {
  label: string
  onTap: () => void
}

export type JoystickOptions = {
  /** Экранное направление с длиной 0–1 для проверки мёртвой зоны; целевая скорость от длины не зависит. */
  onMove: (vector: ScreenPoint) => void
}
