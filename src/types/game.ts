export const SceneBackground = {
  light: 'light',
  dark: 'dark',
} as const

export type SceneBackground = (typeof SceneBackground)[keyof typeof SceneBackground]

export const PhaseName = {
  idle: 'idle',
  spinning: 'spinning',
  result: 'result',
} as const

export type PhaseName = (typeof PhaseName)[keyof typeof PhaseName]

export const StepDirection = {
  forward: 'forward',
  backward: 'backward',
} as const

export type StepDirection = (typeof StepDirection)[keyof typeof StepDirection]

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
