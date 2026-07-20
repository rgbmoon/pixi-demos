import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import { BackgroundAnimation } from 'src/game/animations/background-animation'
import type { GameTicker } from 'src/game/game-ticker'
import { LiveContainer } from 'src/game/ui/live-container'
import type { SceneStore } from 'src/stores/scene-store'
import { SceneBackground } from 'src/types/game'

/**
 * Контроллер фона: создаёт анимацию и по теме из SceneStore переключает фон fade-ом.
 */
@injectable()
export class BackgroundController extends LiveContainer {
  private readonly animation: BackgroundAnimation

  constructor(@inject(TOKENS.GameTicker) ticker: GameTicker, @inject(TOKENS.SceneStore) sceneStore: SceneStore) {
    super()

    this.animation = new BackgroundAnimation(
      ticker,
      sceneStore.isAutospin ? SceneBackground.dark : SceneBackground.light
    )
    this.addChild(this.animation.view)

    this.watch(
      () => sceneStore.isAutospin,
      (isAutospin) => this.animation.fadeTo(isAutospin)
    )
  }

  layout(width: number, height: number): void {
    this.animation.resize(width, height)
  }
}
