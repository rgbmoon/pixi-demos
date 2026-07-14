export const RequestStatus = {
  idle: 'idle',
  loading: 'loading',
  success: 'success',
  error: 'error',
} as const

export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus]
