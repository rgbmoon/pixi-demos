import { inject, injectable } from 'inversify'
import { Container } from 'pixi.js'
import { TOKENS } from 'src/constants/tokens'
import type { ReelsController } from 'src/game/controllers/reels-controller'

import type { AutospinToggleButton } from '../controllers/autospin-toggle-button'
import type { BackgroundController } from '../controllers/background-controller'
import type { SoundToggleButton } from '../controllers/sound-toggle-button'
import type { SpinButton } from '../controllers/spin-button'

/**
 * Сцена игры: собирает контроллеры в дерево отображения и расставляет их по экрану.
 * Новый контроллер подключается здесь и в bindings.ts.
 */
@injectable()
export class GameScene extends Container {
  private readonly background: BackgroundController
  private readonly reels: ReelsController
  private readonly spinButton: SpinButton
  private readonly soundToggleButton: SoundToggleButton
  private readonly autospinToggleButton: AutospinToggleButton

  constructor(
    @inject(TOKENS.BackgroundController) background: BackgroundController,
    @inject(TOKENS.ReelsController) reels: ReelsController,
    @inject(TOKENS.SpinButton) spinButton: SpinButton,
    @inject(TOKENS.SoundToggleButton) soundToggleButton: SoundToggleButton,
    @inject(TOKENS.AutospinToggleButton) autospinToggleButton: AutospinToggleButton
  ) {
    super()

    this.background = background
    this.reels = reels
    this.spinButton = spinButton
    this.soundToggleButton = soundToggleButton
    this.autospinToggleButton = autospinToggleButton

    this.addChild(background, reels, spinButton, soundToggleButton, autospinToggleButton)
  }

  layout(screenWidth: number, screenHeight: number): void {
    this.background.layout(screenWidth, screenHeight)

    this.soundToggleButton.position.set(20, 20)

    this.reels.position.set((screenWidth - this.reels.width) / 2, screenHeight / 2 - this.reels.height)
    this.spinButton.position.set((screenWidth - this.spinButton.width) / 2, screenHeight - this.spinButton.height - 20)
    this.autospinToggleButton.position.set(
      (screenWidth - this.autospinToggleButton.width) / 2 - this.spinButton.width,
      screenHeight - this.autospinToggleButton.height - 35
    )
  }
}
