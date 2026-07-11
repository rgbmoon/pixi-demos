import type { ZodType } from 'zod'

export const RequestStatus = {
  idle: 'idle',
  loading: 'loading',
  success: 'success',
  error: 'error',
} as const

export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus]

export type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: unknown) => void
  schema: ZodType
  timeoutId: ReturnType<typeof setTimeout>
}

export type PushListener = {
  schema: ZodType
  handler: (value: unknown) => void
}
