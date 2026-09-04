import { inject, injectable } from 'inversify'
import type { SymbolKey } from 'src/games/slot/types'
import { NET_TOKENS } from 'src/net/tokens'
import { envelope } from 'src/net/utils'
import type { WsTransport } from 'src/net/ws-transport'
import { z } from 'zod'

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

const GameInitResultSchema = z.object({
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

export type GameInitResult = z.infer<typeof GameInitResultSchema>

const GameInitResponseSchema = envelope(z.array(z.unknown()), GameInitResultSchema)

const SpinResultSchema = z.object({
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

export type SpinResult = z.infer<typeof SpinResultSchema>

const SpinResponseSchema = envelope(
  z.array(
    z.object({
      bet: z.number(),
      gameMode: z.string(),
    })
  ),
  SpinResultSchema
)

/**
 * Эндпоинты слота: методы отправляют запрос через транспорт,
 * разбирают конверт zod-схемой и возвращают его полезную часть — `result`.
 */
@injectable()
export class SlotApi {
  private readonly transport: WsTransport

  constructor(@inject(NET_TOKENS.WsTransport) transport: WsTransport) {
    this.transport = transport
  }

  async initGame(signal?: AbortSignal): Promise<GameInitResult> {
    const { response } = await this.transport.request('initGame', GameInitResponseSchema, [], { signal })

    return response.result
  }

  async spin(bet: number, gameMode: string, signal?: AbortSignal): Promise<SpinResult> {
    const { response } = await this.transport.request('spin', SpinResponseSchema, [{ bet, gameMode }], { signal })

    return response.result
  }
}
