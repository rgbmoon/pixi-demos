import { Container } from 'inversify'
import { TOKENS } from 'src/constants/tokens'

import { bindApp, bindGame } from './bindings'

/**
 * App-контейнер — composition root приложения. Его биндинги живут всё время работы вкладки;
 */
export const appContainer = new Container({ defaultScope: 'Singleton' })

bindApp(appContainer)

let gameContainer: Container | null = null

/**
 * Собирает контейнер игрового графа на один маунт страницы — child app-контейнера.
 */
export const createGameContainer = (): Container => {
  gameContainer = new Container({ parent: appContainer, defaultScope: 'Singleton' })

  bindGame(gameContainer)

  return gameContainer
}

/**
 * Разбирает текущий игровой контейнер.
 */
export const destroyGameContainer = (): void => {
  if (!gameContainer) {
    return
  }

  // Порядкозависимые анбинды, выполняем отдельно от unbindAll
  gameContainer.unbind(TOKENS.Fsm)
  gameContainer.unbind(TOKENS.SpinePool)
  gameContainer.unbind(TOKENS.GameRoot)
  // unbindAll уничтожает все биндинги
  gameContainer.unbindAll()

  gameContainer = null
}
