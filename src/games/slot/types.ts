export const PhaseName = {
  booting: 'booting',
  idle: 'idle',
  spinning: 'spinning',
  result: 'result',
  respin: 'respin',
  holdWinIntro: 'holdWinIntro',
  holdWinSpin: 'holdWinSpin',
  holdWinCollect: 'holdWinCollect',
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

/** Механика, которую настройки демо просят у сервера на каждом спине; одновременно — только одна. */
export const ForcedMechanic = {
  anticipation: 'anticipation',
  respin: 'respin',
  holdWin: 'holdWin',
} as const

export type ForcedMechanic = (typeof ForcedMechanic)[keyof typeof ForcedMechanic]

/** Значение ячейки поля Hold & Win: номинал монеты в деньгах или `null` — пустая ячейка. */
export type CoinValue = number | null

/** Значение слота ленты Hold & Win: ячейка поля или символ наполнения, который виден только в движении. */
export type HoldWinCell = CoinValue | SymbolKey

/** Геометрия линии выплат: ряд (0..2) на каждом барабане и вертикальный сдвиг линии в долях высоты ячейки. */
export type PaylineShape = {
  readonly rows: number[]
  readonly offsetCells: number
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
  onPress?: () => void
  onRelease?: (inside: boolean) => void
  label?: string
}

export const LabelColor = {
  cyan: 'cyan',
  red: 'red',
  white: 'white',
} as const

export type LabelColor = (typeof LabelColor)[keyof typeof LabelColor]

export type LabelOptions = {
  color: LabelColor
  fontSize: number
  text?: string
}

/** Вид отметки: галка — независимый флаг, точка — выбор одного из группы. */
export const CheckboxVariant = {
  box: 'box',
  radio: 'radio',
} as const

export type CheckboxVariant = (typeof CheckboxVariant)[keyof typeof CheckboxVariant]

export type CheckboxOptions = {
  label: string
  width: number
  variant?: CheckboxVariant
  onTap?: () => void
}

export const SpinButtonMode = {
  spin: 'spin',
  stop: 'stop',
  turbo: 'turbo',
} as const

export type SpinButtonMode = (typeof SpinButtonMode)[keyof typeof SpinButtonMode]

/** Направление шага по упорядоченному списку значений: ставки, режимы, страницы. */
export const StepDirection = {
  forward: 'forward',
  backward: 'backward',
} as const

export type StepDirection = (typeof StepDirection)[keyof typeof StepDirection]
