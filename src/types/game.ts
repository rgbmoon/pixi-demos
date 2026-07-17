export type SpinResult = {
  symbols: number[]
  win: number
}

export const SceneTheme = {
  light: 'light',
  dark: 'dark',
} as const

export type SceneTheme = (typeof SceneTheme)[keyof typeof SceneTheme]

export const PhaseName = {
  idle: 'idle',
  spinning: 'spinning',
  result: 'result',
} as const

export type PhaseName = (typeof PhaseName)[keyof typeof PhaseName]
