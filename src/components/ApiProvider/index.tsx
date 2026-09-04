import type { ReactNode } from 'react'

import { type AppApi, ApiContext } from './context'

interface ApiProviderProps {
  value: AppApi
  children: ReactNode
}

/**
 * Отдаёт React-дереву сетевые сервисы. Значение приходит пропсом из композиции:
 * сам провайдер контейнера не знает и остаётся частью UI-кита.
 */
export const ApiProvider = ({ value, children }: ApiProviderProps) => (
  <ApiContext value={value}>{children}</ApiContext>
)
