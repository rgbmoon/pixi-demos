import { setupWorker } from 'msw/browser'
import { createHandlers } from 'src/games/slot/mocks/handlers'
import { parseMockOptions } from 'src/games/slot/mocks/utils'

// Сценарий и сид приходят строкой запуска: /slot?scenario=bigwin&seed=1
export const worker = setupWorker(...createHandlers(parseMockOptions(window.location.search)))
