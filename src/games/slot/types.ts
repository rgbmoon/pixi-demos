export const PhaseName = {
  booting: 'booting',
  idle: 'idle',
  spinning: 'spinning',
  result: 'result',
} as const

export type PhaseName = (typeof PhaseName)[keyof typeof PhaseName]

export const SymbolKey = {
  S: 'S',
  W: 'W',
  A: 'A',
  E: 'E',
  F: 'F',
  K: 'K',
  L: 'L',
  M: 'M',
  N: 'N',
  O: 'O',
  P: 'P',
} as const

export type SymbolKey = (typeof SymbolKey)[keyof typeof SymbolKey]

/** Геометрия линии выплат: ряд (0..2) на каждом барабане и вертикальный сдвиг линии в долях высоты ячейки. */
export type PaylineShape = {
  readonly rows: number[]
  readonly offsetCells: number
}

/** Расписание посадки барабана: путь ленты до остановки и её позиция на любом кадре посадки. */
export type LandingPlan = {
  /** Полный путь ленты до остановки, px. */
  readonly distance: number
  /** Длительность посадки в кадрах приведённой частоты. */
  readonly totalFrames: number
  /** Позиция ленты через `frames` кадров после начала посадки, px от её старта. */
  positionAt(frames: number): number
}

export const ButtonSize = {
  md: 'md',
  lg: 'lg',
} as const

export type ButtonSize = (typeof ButtonSize)[keyof typeof ButtonSize]

export const ButtonVariant = {
  romb: 'romb',
  circle: 'circle',
} as const

export type ButtonVariant = (typeof ButtonVariant)[keyof typeof ButtonVariant]

export type ButtonOptions = {
  variant: ButtonVariant
  size: ButtonSize
  icon: string
  iconRatio?: number
  onTap?: () => void
}

export const LabelColor = {
  cyan: 'cyan',
  white: 'white',
} as const

export type LabelColor = (typeof LabelColor)[keyof typeof LabelColor]

export type LabelOptions = {
  color: LabelColor
  fontSize: number
  text?: string
}

/** Ячейка поля: барабан и ряд в нём. */
export type WinCell = {
  reel: number
  row: number
}

/** Направление шага по упорядоченному списку значений: ставки, режимы, страницы. */
export const StepDirection = {
  forward: 'forward',
  backward: 'backward',
} as const

export type StepDirection = (typeof StepDirection)[keyof typeof StepDirection]
