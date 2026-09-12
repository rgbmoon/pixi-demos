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

/** Шаг респина: удержанные барабаны, кадр после посадки и выигрыш этого кадра. */
const RespinStepSchema = z.object({
  held: z.array(z.number()),
  frame: z.array(z.array(z.string<SymbolKey>())),
  paylines: z.array(PaylineSchema),
  win: z.number(),
})

export type RespinStep = z.infer<typeof RespinStepSchema>

/** Адрес ячейки поля: барабан и ряд. */
const CellIndexSchema = z.object({ reel: z.number(), row: z.number() })

/**
 * Шаг каскада: ячейки прошлого кадра, ушедшие из поля, кадр после падения, множитель шага,
 * линии кадра с выплатами без множителя и выигрыш шага с множителем.
 */
const CascadeStepSchema = z.object({
  removed: z.array(CellIndexSchema),
  frame: z.array(z.array(z.string<SymbolKey>())),
  multiplier: z.number(),
  paylines: z.array(PaylineSchema),
  win: z.number(),
})

export type CascadeStep = z.infer<typeof CascadeStepSchema>

/** Поле Hold & Win `[барабан][ряд]`: номинал монеты в деньгах или `null` — пустая ячейка. */
const CoinFrameSchema = z.array(z.array(z.number().nullable()))

/** Шаг Hold & Win: удержанные ячейки, поле после посадки и счётчик респинов после шага. */
const HoldWinStepSchema = z.object({
  held: z.array(CellIndexSchema),
  frame: CoinFrameSchema,
  respinsLeft: z.number(),
})

export type HoldWinStep = z.infer<typeof HoldWinStepSchema>

/** Бонус Hold & Win: стартовое поле и счётчик, шаги, выплата за полное поле и выигрыш бонуса целиком. */
const HoldWinSchema = z.object({
  frame: CoinFrameSchema,
  respins: z.number(),
  steps: z.array(HoldWinStepSchema),
  grand: z.number(),
  win: z.number(),
})

export type HoldWin = z.infer<typeof HoldWinSchema>

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
      type: z.literal('anticipation'),
      value: z.array(z.number()),
    }),
    z.object({
      type: z.literal('respins'),
      value: z.array(RespinStepSchema),
    }),
    z.object({
      type: z.literal('holdAndWin'),
      value: HoldWinSchema,
    }),
    z.object({
      type: z.literal('cascades'),
      value: z.array(CascadeStepSchema),
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

const SpinRequestSchema = z.object({
  bet: z.number(),
  gameMode: z.string(),
  /** Просит сервер о раунде с anticipation. */
  forceAnticipation: z.boolean().optional(),
  /** Просит сервер о раунде с респином. */
  forceRespin: z.boolean().optional(),
  /** Просит сервер о раунде с бонусом Hold & Win. */
  forceHoldWin: z.boolean().optional(),
  /** Просит сервер о раунде с каскадами. */
  forceCascade: z.boolean().optional(),
})

export type SpinRequest = z.infer<typeof SpinRequestSchema>

const SpinResponseSchema = envelope(z.array(SpinRequestSchema), SpinResultSchema)

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

  async spin(request: SpinRequest, signal?: AbortSignal): Promise<SpinResult> {
    const { response } = await this.transport.request('spin', SpinResponseSchema, [request], { signal })

    return response.result
  }
}
