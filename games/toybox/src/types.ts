export const PhaseName = {
  booting: 'booting',
  idle: 'idle',
  descending: 'descending',
  grabbing: 'grabbing',
  ascending: 'ascending',
  delivering: 'delivering',
  releasing: 'releasing',
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

/** Точка экрана в дизайн-единицах макета. */
export type ScreenPoint = {
  x: number
  y: number
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

/** Потеря игрушки по дороге: над какой ячейкой клешня разжимается и кому отдаёт игрушку. */
export type ClawDrop = {
  cell: CellAddress
  onDrop: (id: ToyId) => void
}

/** Потеря игрушки на подъёме: на какой доле хода клешня разжимается и кому отдаёт игрушку. */
export type ClawSlip = {
  share: number
  onDrop: (id: ToyId) => void
}

/**
 * Идентификатор игрушки. Уникален на всё время жизни стора, а не одного наполнения: рендер держит
 * по нему View-компоненты, и повторно выданный id подменил бы новой игрушке чужой силуэт.
 */
export type ToyId = number

export type ShapeKey = 'single' | 'bar2' | 'square4' | 'cube8'

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
  sliding: 'sliding',
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
  /** Место в куче: якорная клетка формы и слой её основания. */
  anchor: CellAddress
  layer: number
  facing: Facing
  state: ToyState
  /** Текущее положение игрушки в координатах мира. */
  point: WorldPoint
  /** Точка, с которой начался текущий ход: от неё и ведётся интерполяция. */
  from: WorldPoint
  /** Цель текущего движения. */
  target: WorldPoint
  /** Сколько текущий ход уже идёт и сколько ему отмерено, мс. */
  elapsed: number
  durationMs: number
  /** Просадка под клешнёй и отскок после посадки, поверх точки. */
  bounce: SpringState
  /** Доля доворота на 90°: растёт вместе с ходом, единица означает, что доворота нет. */
  turn: number
  /** Ключ наложения: считается по ближней к игроку занятой клетке. */
  depth: number
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

export type WorldTweenOptions = {
  readonly from: WorldPoint
  readonly to: WorldPoint
  readonly durationMs: number
  readonly ease: (progress: number) => number
  readonly apply: (point: WorldPoint) => void
}

export type ButtonOptions = {
  label: string
  onTap: () => void
}

export type JoystickOptions = {
  /** Отклонение ручки в экранных осях, длина от 0 до 1; нули означают отпущенный джойстик. */
  onMove: (vector: ScreenPoint) => void
}
