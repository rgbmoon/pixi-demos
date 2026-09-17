export const PhaseName = {
  booting: 'booting',
  idle: 'idle',
} as const

export type PhaseName = (typeof PhaseName)[keyof typeof PhaseName]
