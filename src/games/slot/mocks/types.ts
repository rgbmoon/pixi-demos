import type { SpinResult } from 'src/games/slot/api/slot'

export type SpinRequestPayload = { bet: number; gameMode: string }

/** Одна трансформация результата спина — член дискриминированного union из api-схемы. */
export type SpinTransformation = SpinResult['SpinResponse']['transformations'][number]
