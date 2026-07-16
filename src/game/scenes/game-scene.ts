import { inject, injectable } from 'inversify'
import { Container } from 'pixi.js'
import { TOKENS } from 'src/constants/tokens'
import type { ReelsController } from 'src/game/controllers/reels-controller'
import type { SpinButton } from 'src/game/controllers/spin-button'

/**
 * Сцена игры: собирает контроллеры в дерево отображения и расставляет их по экрану.
 * Новый контроллер подключается здесь и в биндингах — GameRoot о нём не знает.
 */
@injectable()
export class GameScene extends Container {
  private readonly reels: ReelsController
  private readonly spinButton: SpinButton

  constructor(
    @inject(TOKENS.ReelsController) reels: ReelsController,
    @inject(TOKENS.SpinButton) spinButton: SpinButton
  ) {
    super()

    this.reels = reels
    this.spinButton = spinButton

    this.addChild(reels, spinButton)
  }

  /** Расставляет элементы под текущий размер экрана — вся экранная геометрия живёт здесь. */
  layout(screenWidth: number, screenHeight: number): void {
    // Размеры детей — штатные PIXI-границы контейнеров (getBounds по их содержимому)
    this.reels.position.set((screenWidth - this.reels.width) / 2, screenHeight / 2 - this.reels.height)
    this.spinButton.position.set((screenWidth - this.spinButton.width) / 2, screenHeight / 2 + this.spinButton.height)
  }
}
