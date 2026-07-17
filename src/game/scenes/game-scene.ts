import { inject, injectable } from 'inversify'
import { Assets, Container, Sprite } from 'pixi.js'
import { TOKENS } from 'src/constants/tokens'
import type { ReelsController } from 'src/game/controllers/reels-controller'

import type { SoundToggleButton } from '../controllers/sound-toggle-button'
import type { SpinButton } from '../controllers/spin-button'

/**
 * Сцена игры: собирает контроллеры в дерево отображения и расставляет их по экрану.
 * Новый контроллер подключается здесь и в bindings.ts.
 */
@injectable()
export class GameScene extends Container {
  private readonly background = new Sprite()
  private readonly reels: ReelsController
  private readonly spinButton: SpinButton
  private readonly soundToggleButton: SoundToggleButton

  constructor(
    @inject(TOKENS.ReelsController) reels: ReelsController,
    @inject(TOKENS.SpinButton) spinButton: SpinButton,
    @inject(TOKENS.SoundToggleButton) soundToggleButton: SoundToggleButton
  ) {
    super()

    this.reels = reels
    this.spinButton = spinButton
    this.soundToggleButton = soundToggleButton

    this.addChild(this.background, reels, spinButton, soundToggleButton)
    void this.loadBackground()
  }

  private async loadBackground(): Promise<void> {
    const texture = await Assets.load({
      alias: 'al_bg_fs',
      src: '/src/assets/game/graphic/AL_Background/AL_bg_fs.{webp,png}',
    })

    if (this.destroyed) return

    this.background.texture = texture
  }

  layout(screenWidth: number, screenHeight: number): void {
    this.background.width = screenWidth
    this.background.height = screenHeight

    this.reels.position.set((screenWidth - this.reels.width) / 2, screenHeight / 2 - this.reels.height)
    this.spinButton.position.set((screenWidth - this.spinButton.width) / 2, screenHeight / 2 + this.spinButton.height)
    this.soundToggleButton.position.set(20, 20)
  }
}
