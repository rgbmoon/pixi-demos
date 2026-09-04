import { StrictMode } from 'react'

import { configure } from 'mobx'
import { RouterProvider } from 'react-router-dom'
import { ApiProvider } from 'src/components/ApiProvider'
import { NET_TOKENS } from 'src/net/tokens'

import { appContainer } from './container'
import { router } from './router'

// Запись observable вне action — ошибка
configure({ enforceActions: 'always' })

// Сетевые сервисы достаются из контейнера один раз: провайдер лишь раздаёт их дереву
const api = { transport: appContainer.get(NET_TOKENS.WsTransport) }

export const App = () => {
  return (
    <StrictMode>
      <ApiProvider value={api}>
        <RouterProvider router={router} />
      </ApiProvider>
    </StrictMode>
  )
}
