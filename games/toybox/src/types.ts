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

/** Измеренные экранные границы геометрии автомата. */
export type ScreenBounds = {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
  readonly width: number
  readonly height: number
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
 * Идентификатор игрушки. Уникален на всё время жизни стора, включая повторные наполнения: рендер держит
 * по нему View-компоненты, и повторно выданный id подменил бы новой игрушке чужой силуэт.
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

/** Профиль купола для наполнения: пик на полу, крутизна склона и расстояние от пика до дальнего угла. */
export type DomeProfile = {
  readonly peak: GroundPoint
  readonly falloff: number
  readonly reach: number
}

/** Центр игрушки в плоскости сечения и её крен в радианах. */
export type ToyPose = {
  y: number
  z: number
  angle: number
}

/** Что с игрушкой происходит сейчас: от этого зависит, сталкивается ли она с кучей. */
export const ToyState = {
  /** Лежит в куче или движется по ней. */
  free: 'free',
  /** Висит в клешне и повторяет точку захвата. */
  carried: 'carried',
  /** Падает в шахту лотка без столкновений. */
  exiting: 'exiting',
} as const

export type ToyState = (typeof ToyState)[keyof typeof ToyState]

/** Игрушка в модели кучи: форма, срезы глубины и непрерывная поза, которой её рисуют. */
export type ToyBody = {
  readonly id: ToyId
  readonly shape: ShapeKey
  readonly variant: number
  readonly color: number
  /** Ближний срез глубины; игрушка занимает срезы от него на глубину своего положения. */
  slab: number
  /** Центр игрушки в мировых координатах и крен. */
  pose: { point: WorldPoint; angle: number }
  state: ToyState
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

/** Биты фильтра столкновений фикстуры: её категории и категории, с которыми она сталкивается. */
export type CollisionFilter = {
  readonly filterCategoryBits: number
  readonly filterMaskBits: number
}

/** Попадание луча, пущенного вниз: игрушка, в которую он упёрся, и высота точки. */
export type SurfaceHit = {
  id: ToyId | undefined
  z: number
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

/** Состояние пружины: отклонение от цели и скорость его изменения. */
export type SpringState = {
  value: number
  velocity: number
}

/** Цель, период и затухание пружины. */
export type SpringOptions = {
  target: number
  periodMs: number
  damping: number
}

/** Настройки движения и синхронизации анимации захвата. */
export type ClawMotionOptions = {
  readonly settleSwing?: boolean
  drop?: ClawDrop
  readonly onProgress?: (progress: number, grip: WorldPoint) => void
}

/** Одно отменяемое движение клешни, выполняемое её кадровым шагом. */
export type ClawMotion = ClawMotionOptions & {
  readonly from: WorldPoint
  readonly to: WorldPoint
  readonly durationMs: number
  elapsed: number
  readonly complete: () => void
  readonly cancel: (reason: unknown) => void
}

/** Длительность твина и функция, которая получает прогресс 0–1 в каждом кадре. */
export type ProgressTweenOptions = {
  readonly durationMs: number
  readonly apply: (progress: number) => void
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
