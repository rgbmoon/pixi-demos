import { StrictMode } from 'react'

import { configure } from 'mobx'
import { RouterProvider } from 'react-router-dom'

import { router } from './router'

// Запись observable вне action — ошибка
configure({ enforceActions: 'always' })

export const App = () => {
  return (
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  )
}
