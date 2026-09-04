import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import { BackgroundAnimation } from 'src/game/animations/background-animation'
import type { GameTicker } from 'src/game/game-ticker'
import { LiveContainer } from 'src/game/ui/live-container'
import type { SceneStore } from 'src/stores/scene-store'

/**
 * Контроллер фона: стоит первым ребёнком сцены и по режиму игры переключает вариант фона fade-ом.
 */
@injectable()
export class BackgroundController extends LiveContainer {
  private readonly animation: BackgroundAnimation

  constructor(@inject(TOKENS.GameTicker) ticker: GameTicker, @inject(TOKENS.SceneStore) sceneStore: SceneStore) {
    super()

    // Фриспиновый фон закреплён за последним режимом списка: отдельного признака у режима нет
    const isFs = () => sceneStore.gameMode === sceneStore.gameModes.at(-1)?.gameMode

    this.animation = new BackgroundAnimation(ticker, isFs())
    this.addChild(this.animation.view)

    this.watch(isFs, (value) => this.animation.fadeTo(value))
  }
}
