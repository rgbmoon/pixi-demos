import type { ZodType } from 'zod'

export type WsTransportOptions = {
  url: string
  timeoutMs?: number
}

export type WsRequestOptions = {
  signal?: AbortSignal
}

export type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: unknown) => void
  schema: ZodType
  dispose: () => void
}

export type PushListener = {
  schema: ZodType
  handler: (value: unknown) => void
}
