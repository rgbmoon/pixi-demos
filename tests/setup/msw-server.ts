import { ws } from 'msw'
import { setupServer } from 'msw/node'
import { WS_URL } from 'src/net/constants'

/** Общий мок-сервер сценариев: хендлеры раунда подставляет `startRound`. */
export const server = setupServer()

/**
 * Ссылка на адрес игры, общая для всех раундов файла: каждый `ws.link` вешает на канал msw слушателя,
 * которого не снять, и на десятом раунде Node предупреждает об утечке.
 */
export const wsLink = ws.link(WS_URL)
