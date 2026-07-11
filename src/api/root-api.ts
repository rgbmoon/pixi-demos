import { z } from 'zod'

import { request, subscribe } from './service'

const PongSchema = z.object({ message: z.string(), time: z.number() })
const BalanceSchema = z.object({ amount: z.number() })
const TickSchema = z.object({ count: z.number() })

export type Pong = z.infer<typeof PongSchema>
export type Balance = z.infer<typeof BalanceSchema>
export type Tick = z.infer<typeof TickSchema>

// TODO убрать примеры ping, balance, deposit, tick root-api.ts, оставить только реальные методы API

// hello-world: запрос-ответ.
export const pingServer = (): Promise<Pong> => request('ping', PongSchema)

// Получить данные с сервера.
export const fetchBalance = (): Promise<Balance> => request('getBalance', BalanceSchema)

// Отправить данные на сервер и получить обновлённый результат.
export const sendDeposit = (amount: number): Promise<Balance> => request('deposit', BalanceSchema, { amount })

// Подписка на серверный поток (push) — сервер сам присылает tick. Возвращает функцию отписки.
export const subscribeTicks = (handler: (tick: Tick) => void): (() => void) => subscribe('tick', TickSchema, handler)
