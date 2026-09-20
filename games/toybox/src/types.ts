import type { Toy } from './ui/box/toy'

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

export type DropResult = {
  path: CellAddress[]
  layer: number
  collected: boolean
}

export type ToySlide = {
  from: CellAddress
  to: CellAddress
}

/** Потеря игрушки по дороге: над какой ячейкой клешня разжимается и кому отдаёт игрушку. */
export type ClawDrop = {
  cell: CellAddress
  onDrop: (toy: Toy) => void
}

/** Потеря игрушки на подъёме: на какой доле хода клешня разжимается и кому отдаёт игрушку. */
export type ClawSlip = {
  share: number
  onDrop: (toy: Toy) => void
}

/** Состояние пружины: отклонение от цели и скорость его изменения. */
export type SpringState = {
  value: number
  velocity: number
}

/** Настройка пружины: куда она тянет, как часто колеблется и как быстро гаснет. */
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
