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
            path: '/slot',
            lazy: async () => {
              const module = await import('src/pages/slot')
              const { SlotPage } = module
              return {
                element: <SlotPage />,
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
