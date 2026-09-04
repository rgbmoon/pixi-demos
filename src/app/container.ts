import { Container } from 'inversify'
import { CORE_TOKENS } from 'src/core/tokens'
import { ENGINE_TOKENS } from 'src/engine/tokens'

import { bindApp } from './bindings'

/**
 * App-контейнер — composition root приложения. Его биндинги живут всё время работы вкладки;
 */
export const appContainer = new Container({ defaultScope: 'Singleton' })

bindApp(appContainer)

let gameContainer: Container | null = null

/**
 * Собирает контейнер игрового графа на один маунт страницы — child app-контейнера.
 * Состав приносит `bindGame` — вместе с общим рантаймом: статически композиционный корень
 * не знает ни игр, ни PIXI, иначе они уедут в стартовый чанк.
 */
export const createGameContainer = (bindGame: (container: Container) => void): Container => {
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
  gameContainer.unbind(CORE_TOKENS.Fsm)
  gameContainer.unbind(ENGINE_TOKENS.SpinePool)
  gameContainer.unbind(ENGINE_TOKENS.GameRoot)
  // unbindAll уничтожает все биндинги
  gameContainer.unbindAll()

  gameContainer = null
}
