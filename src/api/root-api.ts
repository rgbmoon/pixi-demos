import type { SpinResult } from 'src/types/game'
import { z } from 'zod'

import { wsTransport } from './service'

const SpinResultSchema = z.object({
  symbols: z.array(z.number()),
  win: z.number(),
})

export const sendSpin = (bet: number, signal?: AbortSignal): Promise<SpinResult> =>
  wsTransport.request('spin', SpinResultSchema, { bet }, { signal })
