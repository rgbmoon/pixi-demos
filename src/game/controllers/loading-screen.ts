import { inject, injectable } from 'inversify'
import { Rectangle } from 'pixi.js'
import { TOKENS } from 'src/constants/tokens'
import { LoadingScreenAnimation } from 'src/game/animations/loading-screen-animation'
import type { GameTicker } from 'src/game/game-ticker'
import { LiveContainer } from 'src/game/ui/live-container'
import type { SceneStore } from 'src/stores/scene-store'

/** Заглушка на время инициализации: перекрывает сцену, пока не пришли данные initGame. */
@injectable()
export class LoadingScreen extends LiveContainer {
  private readonly animation: LoadingScreenAnimation

  constructor(@inject(TOKENS.GameTicker) ticker: GameTicker, @inject(TOKENS.SceneStore) sceneStore: SceneStore) {
    super()

    this.animation = new LoadingScreenAnimation(ticker)
    this.addChild(this.animation.view)

    // hitArea перехватывает клики по сцене под заглушкой; скрытый контейнер в хит-тесте не участвует
    this.eventMode = 'static'

    this.watch(() => sceneStore.isGameLoading, (isLoading) => void this.toggle(isLoading), { fireImmediately: true })
  }

  /** Заглушка гаснет только после fade — до его конца она ещё перекрывает сцену. */
  private async toggle(isLoading: boolean): Promise<void> {
    if (isLoading) {
      this.visible = true
      this.animation.appear()

      return
    }

    await this.animation.hide()

    if (this.destroyed) return

    this.visible = false
  }

  layout(width: number, height: number): void {
    this.animation.resize(width, height)
    this.hitArea = new Rectangle(0, 0, width, height)
  }
}
