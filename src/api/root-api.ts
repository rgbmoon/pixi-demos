import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import type { SymbolKey } from 'src/types/game'
import { z } from 'zod'

import type { WsTransport } from './service'

/** SignalR-like формат ответа: пара invocation-запрос (type 1) и completion-результат (type 3). */
const envelope = <A extends z.ZodType, R extends z.ZodType>(argumentsSchema: A, resultSchema: R) =>
  z.object({
    request: z.object({
      type: z.literal(1),
      invocationId: z.string(),
      target: z.string(),
      arguments: argumentsSchema,
    }),
    response: z.object({
      type: z.literal(3),
      invocationId: z.string(),
      result: resultSchema,
    }),
  })

const PaylineSchema = z.object({
  lineId: z.string(),
  line: z.array(z.number().nullable()),
  value: z.number(),
})

export type Payline = z.infer<typeof PaylineSchema>

/** Трансформации раунда: дискриминированный по `type` список шагов, общий для `initGame` и `spin`. */
const TransformationsSchema = z.array(
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('frameInit'),
      value: z.array(z.array(z.string<SymbolKey>())),
    }),
    z.object({
      type: z.literal('paylines'),
      value: z.array(PaylineSchema),
    }),
    z.object({
      type: z.literal('win'),
      value: z.number(),
    }),
    z.object({
      type: z.literal('multipliersInit'),
      value: z.array(z.number()),
      context: z.string(),
    }),
    z.object({
      type: z.literal('waitForChoice'),
      value: z.object({
        id: z.string(),
        optionsCount: z.number(),
        selectCount: z.number(),
        defaultOptions: z.array(z.number()),
      }),
    }),
  ])
)

export type RoundTransformation = z.infer<typeof TransformationsSchema>[number]

export const GameInitResponseSchema = envelope(
  z.array(z.unknown()),
  z.object({
    securityHash: z.string(),
    currency: z.string(),
    round: z.object({
      roundId: z.string(),
      bet: z.number(),
      balance: z.number(),
      totalWin: z.number(),
      platformMaxWin: z.number().nullable(),
      endedUtc: z.string(),
      SpinResponse: z.object({
        transformations: TransformationsSchema,
      }),
      freeRoundCampaign: z.null(),
    }),
    gameSettings: z.object({
      paylines: z.record(z.string(), z.array(z.number())),
      payTable: z.record(z.string(), z.record(z.string(), z.number())),
      availableGameModes: z.array(
        z.object({
          gameMode: z.string(),
          name: z.string(),
          type: z.string(),
        })
      ),
      allowedLuckyBets: z.array(
        z.object({
          gameMode: z.string(),
          coefficient: z.number(),
          bets: z.array(z.number()),
        })
      ),
      coinCoefficient: z.number(),
      defaultBetIndex: z.number(),
      allowedBets: z.array(z.number()),
      availableAutoSpinCounts: z.array(z.number()),
      rtpOptions: z.array(
        z.object({
          rtp: z.number(),
          gameMode: z.string(),
          volatility: z.string(),
        })
      ),
      locales: z.array(z.string()),
      platformMaxWin: z.number().nullable(),
      currencyMinimalUnit: z.number(),
    }),
    freeRoundCampaign: z.null(),
    gamificationToken: z.string(),
    isDemo: z.boolean(),
  })
)

export type GameInitResponse = z.infer<typeof GameInitResponseSchema>

export const SpinResponseSchema = envelope(
  z.array(
    z.object({
      bet: z.number(),
      gameMode: z.string(),
    })
  ),
  z.object({
    roundId: z.string(),
    bet: z.number(),
    balance: z.number(),
    totalWin: z.number(),
    platformMaxWin: z.number().nullable(),
    endedUtc: z.string().nullable(),
    SpinResponse: z.object({
      transformations: TransformationsSchema,
    }),
    freeRoundCampaign: z.null(),
  })
)

export type SpinResponse = z.infer<typeof SpinResponseSchema>

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

  initGame(signal?: AbortSignal): Promise<GameInitResponse> {
    return this.transport.request('initGame', GameInitResponseSchema, [], { signal })
  }

  sendSpin(bet: number, gameMode: string, signal?: AbortSignal): Promise<SpinResponse> {
    return this.transport.request('spin', SpinResponseSchema, [{ bet, gameMode }], { signal })
  }
}
