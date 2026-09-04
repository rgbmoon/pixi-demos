import type { Container } from 'inversify'

import { GameRoot } from './game-root'
import { GameTicker } from './game-ticker'
import { SpinePool } from './spine-pool'
import { ENGINE_TOKENS } from './tokens'

/**
 * PIXI-рантайм игры: хост жизненного цикла, игровой тикер и пул скелетов.
 * Пропорции макета и состав скелетов приходят конфигами от самой игры.
 */
export const bindEngine = (container: Container): void => {
  // Игровой тикер создаётся до PIXI-init (app.ticker появляется только внутри него);
  // GameRoot после init переводит на него рендер, и умирает он вместе с приложением
  container.bind(ENGINE_TOKENS.GameTicker).to(GameTicker)

  container
    .bind(ENGINE_TOKENS.SpinePool)
    .to(SpinePool)
    .onDeactivation((pool) => pool.destroy())

  container
    .bind(ENGINE_TOKENS.GameRoot)
    .to(GameRoot)
    .onDeactivation((root) => root.unmount())
}
