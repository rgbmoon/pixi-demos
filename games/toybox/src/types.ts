import type { TOY_SPECS } from '#src/toy-specs'

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

/** Состояние света в нише окна выдачи. */
export const PrizeLight = {
  off: 'off',
  dim: 'dim',
  on: 'on',
} as const

export type PrizeLight = (typeof PrizeLight)[keyof typeof PrizeLight]

/** Состояние света лампы табло. */
export const LampLight = {
  off: 'off',
  dim: 'dim',
  on: 'on',
} as const

export type LampLight = (typeof LampLight)[keyof typeof LampLight]

/** Цвет лампы табло: жёлтый — обычная работа, маджента — эффекты и механики, красный — в запасе. */
export const LampColor = {
  yellow: 'yellow',
  magenta: 'magenta',
  red: 'red',
} as const

export type LampColor = (typeof LampColor)[keyof typeof LampColor]

/** Шаг мерцания: состояние света и его длительность, мс. */
export type LightStep = readonly [LampLight, number]

/** Точка мира: `x` и `y` — оси сетки в ячейках, `z` — высота над полом. */
export type WorldPoint = {
  x: number
  y: number
  z: number
}

/** Неподвижный предмет зала: кадр атласа и точка мира под его опорной точкой. */
export type LitterPlacement = {
  frame: string
  point: WorldPoint
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

/** Игрушка каталога: ключ её арта в атласе игрушек. */
export type ToyKey = keyof typeof TOY_SPECS

/** Внешний вид выданной игрушки без её положения в куче. */
export type ToyAppearance = {
  readonly toy: ToyKey
}

/** Выданная игрушка: внешний вид и отметка, что она зажигает лампу табло. */
export type Prize = ToyAppearance & {
  readonly hasLamp?: boolean
}

/** Точка плоскости сечения: `y` — ось поля вдоль фронтальной грани, `z` — высота. */
export type SectionPoint = {
  y: number
  z: number
}

/** Центр игрушки в плоскости сечения и её крен в радианах. */
export type ToyPose = {
  y: number
  z: number
  angle: number
}

/** Игрушка в снимке: игрушка каталога, срезы, поза покоя и отметка лампы табло. */
export type HeapSnapshotBody = {
  slab: number
  y: number
  z: number
  angle: number
  toy: ToyKey
  /** Выигранная игрушка зажигает следующую лампу табло; у остальных игрушек поля нет. */
  hasLamp?: boolean
}

/** Снимок для хранилища: позы покоя кучи в кубе и игрушек на полу, без скоростей. */
export type HeapSnapshot = {
  version: number
  collected: number
  bodies: HeapSnapshotBody[]
  floor: HeapSnapshotBody[]
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

/** Размер кадра в пикселях арта. */
export type FrameSize = {
  readonly width: number
  readonly height: number
}

/** Грань корпуса в мире: левый верхний угол рисунка, конец его верхнего края и конец левого края. */
export type FaceCorners = {
  readonly origin: WorldPoint
  readonly right: WorldPoint
  readonly down: WorldPoint
}

/** Аффинная матрица кадра грани в единицах сцены: столбцы — шаг пикселя кадра вправо и вниз, затем начало. */
export type FaceMatrix = {
  readonly a: number
  readonly b: number
  readonly c: number
  readonly d: number
  readonly tx: number
  readonly ty: number
}

/** Пылинка фона: место в пикселях арта, скорость в пикселях арта за секунду, возраст и срок жизни в мс. */
export type DustMote = {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
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

/** Действия кнопок диалога подтверждения сброса. */
export type ResetConfirmOptions = {
  onConfirm: () => void
  onCancel: () => void
}

/** Куда смотрит острие хвоста облака диалога относительно облака: вверх или вниз, вправо или влево. */
export type BubbleTail = {
  readonly up: boolean
  readonly right: boolean
}

/** Кадры кнопки атласа органов управления: обычная и нажатая. */
export type ButtonFrames = {
  readonly normal: string
  readonly pressed: string
}

/** Последовательности атласа игрушки: кадры крена, обводка подсветки тех же поз и тик на полу, если он нарисован. */
export type ToySequences = {
  readonly body: string
  readonly outline: string
  /** Поза тика на полу по кадрам крена. */
  readonly twitch?: string
}

export type JoystickOptions = {
  /** Экранное направление с длиной 0–1 для проверки мёртвой зоны; целевая скорость от длины не зависит. */
  onMove: (vector: ScreenPoint) => void
}
