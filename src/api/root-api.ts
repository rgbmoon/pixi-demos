import type { SpinResult } from 'src/types/game'
import { z } from 'zod'

import { request } from './service'

const SpinResultSchema = z.object({
  symbols: z.array(z.number()),
  win: z.number(),
})

export const sendSpin = (bet: number): Promise<SpinResult> => request('spin', SpinResultSchema, { bet })
