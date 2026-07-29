import { createRoot } from 'react-dom/client'

import './styles/index.css'

import { App } from './app'

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS ? import.meta.env.VITE_USE_MOCKS === 'true' : import.meta.env.DEV

const startMocking = async (): Promise<void> => {
  if (!USE_MOCKS) {
    return
  }

  const { worker } = await import('src/mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
}

void startMocking().then(() => {
  createRoot(document.getElementById('root')!).render(<App />)
})
