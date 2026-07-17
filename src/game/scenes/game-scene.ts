import { inject, injectable } from 'inversify'
import { Container } from 'pixi.js'
import { TOKENS } from 'src/constants/tokens'
import type { ReelsController } from 'src/game/controllers/reels-controller'

import type { BackgroundController } from '../controllers/background-controller'
import type { SoundToggleButton } from '../controllers/sound-toggle-button'
import type { SpinButton } from '../controllers/spin-button'
import type { ThemeToggleButton } from '../controllers/theme-toggle-button'

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
  private readonly themeToggleButton: ThemeToggleButton

  constructor(
    @inject(TOKENS.BackgroundController) background: BackgroundController,
    @inject(TOKENS.ReelsController) reels: ReelsController,
    @inject(TOKENS.SpinButton) spinButton: SpinButton,
    @inject(TOKENS.SoundToggleButton) soundToggleButton: SoundToggleButton,
    @inject(TOKENS.ThemeToggleButton) themeToggleButton: ThemeToggleButton
  ) {
    super()

    this.background = background
    this.reels = reels
    this.spinButton = spinButton
    this.soundToggleButton = soundToggleButton
    this.themeToggleButton = themeToggleButton

    this.addChild(background, reels, spinButton, soundToggleButton, themeToggleButton)
  }

  layout(screenWidth: number, screenHeight: number): void {
    this.background.layout(screenWidth, screenHeight)

    this.reels.position.set((screenWidth - this.reels.width) / 2, screenHeight / 2 - this.reels.height)
    this.spinButton.position.set((screenWidth - this.spinButton.width) / 2, screenHeight / 2 + this.spinButton.height)
    this.soundToggleButton.position.set(20, 20)
    this.themeToggleButton.position.set(screenWidth - this.themeToggleButton.width - 20, 20)
  }
}
