import { z } from 'zod'

/** SignalR-like формат ответа: пара invocation-запрос (type 1) и completion-результат (type 3). */
export const envelope = <A extends z.ZodType, R extends z.ZodType>(argumentsSchema: A, resultSchema: R) =>
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
