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

/** Адрес ячейки сетки: колонка по оси `x`, ряд по оси `y`. */
export type CellAddress = {
  col: number
  row: number
}

/** Адрес клетки объёма: ячейка пола и слой над ней. */
export type VolumeCell = CellAddress & {
  layer: number
}

/** Действие на заданной доле перемещения после обновления точки захвата. */
export type ClawDrop = {
  share: number
  onDrop: (grip: WorldPoint) => void
}

/** Ячейка маршрута и интервал её пересечения, в долях пути. */
export type PathCell = {
  cell: CellAddress
  enter: number
  exit: number
}

/**
 * Идентификатор игрушки. Уникален на всё время жизни стора, включая повторные наполнения: рендер держит
 * по нему View-компоненты, и повторно выданный id подменил бы новой игрушке чужой силуэт.
 */
export type ToyId = number

export type ShapeKey = 'single' | 'bar2' | 'square4' | 'cube8'

/** Внешний вид выданной игрушки без её положения в куче. */
export type ToyAppearance = {
  readonly shape: ShapeKey
  readonly color: number
}

/**
 * Результат отпускания текущего цикла: игрушки в пути нет, отпущенная игрушка ещё движется или дошла до дна
 * лотка. После посадки отпущенной игрушки в кучу результат снова `none`; он хранится до начала следующего цикла.
 */
export type ReleaseOutcome =
  | { status: 'none' }
  | { status: 'pending'; id: ToyId }
  | { status: 'collected'; appearance: ToyAppearance }

/** Клетка формы относительно её якоря, в базовой ориентации. */
export type ShapeCell = {
  dx: number
  dy: number
  dz: number
}

/** Форма игрушки: занимаемые клетки и то, как часто она попадается при наполнении куба. */
export type Shape = {
  readonly cells: readonly ShapeCell[]
  readonly fillWeight: number
}

/** Ориентация формы вокруг вертикальной оси: четверть оборота на шаг. */
export type Facing = 0 | 1 | 2 | 3

/** Куда игрушка встаёт: якорь формы, её ориентация и слой основания. */
export type Placement = {
  anchor: CellAddress
  facing: Facing
  layer: number
}

/** Занята ли клетка объёма: этим предикатом планировщики читают решётку, не зная о сторе. */
export type Occupancy = (cell: VolumeCell) => boolean

/** Верх занятости ячейки: этим читателем планировщики видят рельеф кучи. */
export type Surface = (cell: CellAddress) => number

/** Дыра в куче: её столбцы, слой основания и насколько её край выше этого основания. */
export type Hole = {
  cells: CellAddress[]
  floor: number
  depth: number
}

/** Что с игрушкой происходит сейчас: от этого зависит, ведёт ли её кадровый шаг. */
export const ToyState = {
  resting: 'resting',
  falling: 'falling',
  carried: 'carried',
  landingBeforeTray: 'landingBeforeTray',
  waitingForTraySlide: 'waitingForTraySlide',
  slidingToTray: 'slidingToTray',
  fallingIntoTray: 'fallingIntoTray',
} as const

export type ToyState = (typeof ToyState)[keyof typeof ToyState]

/** Игрушка в модели кучи: место в решётке и непрерывное состояние, которым её рисуют. */
export type ToyBody = {
  readonly id: ToyId
  readonly shape: ShapeKey
  readonly color: number
  /** Зарезервированное размещение в решётке; у удерживаемой игрушки — прежнее место. */
  placement: Placement
  /** Текущая отображаемая поза в мировых координатах. */
  pose: { point: WorldPoint; facing: Facing }
  state: ToyState
  /** Точка, с которой начался текущий ход: от неё и ведётся интерполяция. */
  from: WorldPoint
  /** Цель текущего движения. */
  target: WorldPoint
  /** Сколько текущий ход уже идёт и сколько ему отмерено, мс. */
  elapsed: number
  durationMs: number
  /** Просадка под клешнёй и отскок после посадки, поверх точки. */
  bounce: SpringState
}

/** Снимок кучи для хранилища: только решётка, без непрерывного состояния. */
export type HeapSnapshot = {
  version: number
  collected: number
  bodies: {
    shape: ShapeKey
    facing: Facing
    anchor: CellAddress
    layer: number
    color: number
  }[]
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
