import { inject, injectable } from 'inversify'
import { Graphics, Rectangle } from 'pixi.js'
import { PALETTE } from 'src/constants/palette'
import { TOKENS } from 'src/constants/tokens'
import { Label, LabelColor } from 'src/game/ui/label'
import { LiveContainer } from 'src/game/ui/live-container'
import type { SceneStore } from 'src/stores/scene-store'

/** Заглушка на время инициализации: перекрывает сцену, пока не пришли данные initGame. */
@injectable()
export class LoadingScreen extends LiveContainer {
  private readonly backdrop = new Graphics()
  private readonly caption = new Label({ color: LabelColor.gold, fontSize: 32, text: 'Loading...' })

  constructor(@inject(TOKENS.SceneStore) sceneStore: SceneStore) {
    super()

    this.caption.anchor.set(0.5)

    this.addChild(this.backdrop, this.caption)

    // hitArea перехватывает клики по сцене под заглушкой; скрытый контейнер в хит-тесте не участвует
    this.eventMode = 'static'

    this.watch(
      () => sceneStore.isGameLoading,
      (isLoading) => {
        this.visible = isLoading
      },
      { fireImmediately: true }
    )
  }

  layout(width: number, height: number): void {
    this.backdrop.clear().rect(0, 0, width, height).fill(PALETTE.accent)
    this.hitArea = new Rectangle(0, 0, width, height)

    this.caption.position.set(width / 2, height / 2)
  }
}
