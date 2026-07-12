export type SpinResult = {
  symbols: number[]
  win: number
}

export const PhaseName = {
  idle: 'idle',
  spinning: 'spinning',
  result: 'result',
} as const

export type PhaseName = (typeof PhaseName)[keyof typeof PhaseName]
