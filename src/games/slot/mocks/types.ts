import type { Random } from 'src/core/types'
import type { SpinResult } from 'src/games/slot/api/slot'

export type SpinRequestPayload = {
  bet: number
  gameMode: string
  forceAnticipation: boolean
  forceRespin: boolean
  forceHoldWin: boolean
}

/** Форсирование исхода раунда: стандартный инструмент прогонов и e2e. */
export const MockScenario = {
  random: 'random',
  bigwin: 'bigwin',
  nowin: 'nowin',
  anticipation: 'anticipation',
  respin: 'respin',
  holdwin: 'holdwin',
  error: 'error',
} as const

export type MockScenario = (typeof MockScenario)[keyof typeof MockScenario]

/** Настройки мок-сервера: чем разыгрывать случайность и какой исход форсировать. */
export type MockOptions = {
  random: Random
  scenario: MockScenario
}

/** Одна трансформация результата спина — член дискриминированного union из api-схемы. */
export type SpinTransformation = SpinResult['SpinResponse']['transformations'][number]
