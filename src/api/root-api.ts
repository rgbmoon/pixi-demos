import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import type { SpinResult } from 'src/types/game'
import { z } from 'zod'

import type { WsTransport } from './service'

const SpinResultSchema: z.ZodType<SpinResult> = z.object({
  symbols: z.array(z.number()),
  win: z.number(),
})

/**
 * Описание эндпоинтов корневого домена: методы отправляют запрос через транспорт
 * и возвращают ответ, разобранный zod-схемой.
 */
@injectable()
export class RootApi {
  private readonly transport: WsTransport

  constructor(@inject(TOKENS.WsTransport) transport: WsTransport) {
    this.transport = transport
  }

  /** Запрашивает у сервера результат спина для ставки `bet`. */
  sendSpin(bet: number, signal?: AbortSignal): Promise<SpinResult> {
    return this.transport.request('spin', SpinResultSchema, { bet }, { signal })
  }
}
