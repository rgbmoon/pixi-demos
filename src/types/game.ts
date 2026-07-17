export type SpinResult = {
  symbols: number[]
  win: number
}

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
