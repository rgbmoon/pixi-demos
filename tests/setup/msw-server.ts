import { setupServer } from 'msw/node'

/** Общий мок-сервер сценариев: хендлеры раунда подставляет `startRound`. */
export const server = setupServer()
