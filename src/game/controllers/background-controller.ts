import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import { BackgroundAnimation } from 'src/game/animations/background-animation'
import type { GameTicker } from 'src/game/game-ticker'
import { LiveContainer } from 'src/game/ui/live-container'
import type { SceneStore } from 'src/stores/scene-store'

/**
 * Контроллер фона: создаёт анимацию и по теме из SceneStore переключает фон fade-ом.
 */
@injectable()
export class BackgroundController extends LiveContainer {
  private readonly animation: BackgroundAnimation

  constructor(@inject(TOKENS.GameTicker) ticker: GameTicker, @inject(TOKENS.SceneStore) sceneStore: SceneStore) {
    super()

    // стартовая тема ставится мгновенно в конструкторе анимации, fade — только на переключения
    this.animation = new BackgroundAnimation(ticker, sceneStore.theme)
    this.addChild(this.animation.view)

    this.watch(
      () => sceneStore.theme,
      (theme) => this.animation.fadeTo(theme)
    )
  }

  layout(width: number, height: number): void {
    this.animation.resize(width, height)
  }
}
