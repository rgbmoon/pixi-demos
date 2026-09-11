import { createRoot } from 'react-dom/client'
import { installGlobalHandlers, notifyError, traceError } from 'src/core/errors/utils'

import './styles/index.css'

import { App } from './app'

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS ? import.meta.env.VITE_USE_MOCKS === 'true' : import.meta.env.DEV

const startMocking = async (): Promise<void> => {
  if (!USE_MOCKS) {
    return
  }

  const { network } = await import('src/app/mocks/browser')
  network.enable()
}

// Последний рубеж для всего, что не поймано локально; ставится до рендера
installGlobalHandlers()

const start = async (): Promise<void> => {
  try {
    await startMocking()
  } catch (error) {
    traceError?.(error, 'Mocks failed to start')
  }

  createRoot(document.getElementById('root')!, {
    onUncaughtError: (error) => notifyError(error, 'Interface error'),
    onCaughtError: (error) => traceError?.(error),
    onRecoverableError: (error) => traceError?.(error),
  }).render(<App />)
}

void start()
