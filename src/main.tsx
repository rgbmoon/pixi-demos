import { createRoot } from 'react-dom/client'

import './styles/index.css'

import { App } from './app'

const startMocking = async (): Promise<void> => {
  if (!import.meta.env.DEV) {
    return
  }

  const { worker } = await import('src/mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
}

void startMocking().then(() => {
  createRoot(document.getElementById('root')!).render(<App />)
})
