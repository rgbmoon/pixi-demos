import type { WebSocketLink } from 'msw'
import type { Random } from 'src/core/types'

export type WsReply = (result: unknown) => void
export type WsFail = (error: string) => void
export type WsEndpoint = (args: unknown[], reply: WsReply, fail: WsFail) => void

export type WsConnectionContext = {
  push: (target: string, args: unknown[]) => void
  onClose: (cleanup: () => void) => void
}

export type WsDelayRange = { min: number; max: number }

export type CreateWsHandlerOptions = {
  /**
   * Ссылка на перехватываемый адрес: `ws.link(url)`. Каждый вызов `ws.link` навсегда вешает слушателя
   * на общий канал msw, поэтому ссылку создаёт вызывающий — одну на время жизни перехвата.
   */
  link: WebSocketLink
  endpoints: Record<string, WsEndpoint>
  /** Задержка ответа по имени эндпоинта; неперечисленные отвечают с дефолтной латентностью. */
  delays?: Record<string, WsDelayRange>
  onConnect?: (context: WsConnectionContext) => void
  /** Источник случайности для латентности: сид делает прогон воспроизводимым. */
  random?: Random
}
