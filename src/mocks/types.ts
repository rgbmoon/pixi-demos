import type { SpinResponse } from 'src/api/root-api'

export type WsReply = (result: unknown) => void
export type WsFail = (error: string) => void
export type WsEndpoint = (args: unknown[], reply: WsReply, fail: WsFail) => void

export type WsConnectionContext = {
  push: (target: string, args: unknown[]) => void
  onClose: (cleanup: () => void) => void
}

export type WsDelayRange = { min: number; max: number }

export type CreateWsHandlerOptions = {
  url: string
  endpoints: Record<string, WsEndpoint>
  /** Задержка ответа по имени эндпоинта; неперечисленные отвечают с дефолтной латентностью. */
  delays?: Record<string, WsDelayRange>
  onConnect?: (context: WsConnectionContext) => void
}

export type SpinRequestPayload = { bet: number; gameMode: number }

/** Одна трансформация результата спина — член дискриминированного union из api-схемы. */
export type SpinTransformation = SpinResponse['response']['result']['SpinResponse']['transformations'][number]
