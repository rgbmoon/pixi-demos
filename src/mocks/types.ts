export type WsReply = (type: string, payload: unknown) => void
export type WsFail = (code: string, message: string) => void
export type WsEndpoint = (payload: unknown, reply: WsReply, fail: WsFail) => void

export type WsConnectionContext = {
  push: (type: string, payload: unknown) => void
  onClose: (cleanup: () => void) => void
}

export type CreateWsHandlerOptions = {
  url: string
  endpoints: Record<string, WsEndpoint>
  onConnect?: (context: WsConnectionContext) => void
}
