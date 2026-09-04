import { createContext, useContext } from 'react'

import type { WsTransport } from 'src/net/ws-transport'

/**
 * Сетевые сервисы, доступные React-дереву. Пополняется по мере надобности:
 * фасады эндпоинтов лендинга и лобби кладутся сюда же, игровые остаются в её контейнере.
 */
export interface AppApi {
  transport: WsTransport
}

export const ApiContext = createContext<AppApi | null>(null)

/** Сетевые сервисы приложения. Вне `ApiProvider` вызывать нельзя — это ошибка сборки дерева. */
export const useApi = (): AppApi => {
  const api = useContext(ApiContext)

  if (!api) {
    throw new Error('useApi: no ApiProvider above')
  }

  return api
}
