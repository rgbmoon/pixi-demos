import { createBrowserRouter } from 'react-router-dom'
import { Layout } from 'src/components/Layout'
import { RouteError } from 'src/components/RouteError'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      {
        errorElement: <RouteError />,
        children: [
          {
            path: '/',
            lazy: async () => {
              const module = await import('src/pages/main')
              const { MainPage } = module
              return {
                element: <MainPage />,
              }
            },
          },
          {
            path: '/game',
            lazy: async () => {
              const module = await import('src/pages/game')
              const { GamePage } = module
              return {
                element: <GamePage />,
              }
            },
          },
          {
            path: '*',
            lazy: async () => {
              const module = await import('src/pages/not-found')
              const { NotFoundPage } = module
              return {
                element: <NotFoundPage />,
              }
            },
          },
        ],
      },
    ],
  },
])
