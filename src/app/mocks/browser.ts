import { setupWorker } from 'msw/browser'
import { handlers } from 'src/games/slot/mocks/handlers'

export const worker = setupWorker(...handlers)
