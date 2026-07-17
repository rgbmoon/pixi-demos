import { inject, injectable } from 'inversify'
import { Assets, Container, Sprite } from 'pixi.js'
import { TOKENS } from 'src/constants/tokens'
import type { ReelsController } from 'src/game/controllers/reels-controller'

import type { AutospinToggleButton } from '../controllers/autospin-toggle-button'
import type { BackgroundController } from '../controllers/background-controller'
import type { BetPanel } from '../controllers/bet-panel'
import type { CreditLabel } from '../controllers/credit-label'
import type { SoundToggleButton } from '../controllers/sound-toggle-button'
import type { SpinButton } from '../controllers/spin-button'
import type { WinLabel } from '../controllers/win-label'

/**
 * Сцена игры: собирает контроллеры в дерево отображения и расставляет их по экрану.
 * Новый контроллер подключается здесь и в bindings.ts.
 */
@injectable()
export class GameScene extends Container {
  private readonly background: BackgroundController
  private readonly logo = new Sprite()
  private readonly reels: ReelsController
  private readonly spinButton: SpinButton
  private readonly soundToggleButton: SoundToggleButton
  private readonly autospinToggleButton: AutospinToggleButton
  private readonly winLabel: WinLabel
  private readonly betPanel: BetPanel
  private readonly creditLabel: CreditLabel

  constructor(
    @inject(TOKENS.BackgroundController) background: BackgroundController,
    @inject(TOKENS.ReelsController) reels: ReelsController,
    @inject(TOKENS.SpinButton) spinButton: SpinButton,
    @inject(TOKENS.SoundToggleButton) soundToggleButton: SoundToggleButton,
    @inject(TOKENS.AutospinToggleButton) autospinToggleButton: AutospinToggleButton,
    @inject(TOKENS.WinLabel) winLabel: WinLabel,
    @inject(TOKENS.BetPanel) betPanel: BetPanel,
    @inject(TOKENS.CreditLabel) creditLabel: CreditLabel
  ) {
    super()

    this.background = background
    this.reels = reels
    this.spinButton = spinButton
    this.soundToggleButton = soundToggleButton
    this.autospinToggleButton = autospinToggleButton
    this.winLabel = winLabel
    this.betPanel = betPanel
    this.creditLabel = creditLabel

    this.addChild(
      background,
      this.logo,
      reels,
      spinButton,
      soundToggleButton,
      autospinToggleButton,
      winLabel,
      betPanel,
      creditLabel
    )
    void this.loadLogo()
  }

  private async loadLogo(): Promise<void> {
    const texture = await Assets.load('/src/assets/game/graphic/AL_Logo/AL_Logo.png')

    if (this.destroyed) return

    this.logo.texture = texture
  }

  layout(screenWidth: number, screenHeight: number): void {
    this.background.layout(screenWidth, screenHeight)

    this.logo.scale.set(0.4)
    this.logo.anchor.set(0.5, 0)
    this.logo.position.set(screenWidth / 2, 32)

    this.soundToggleButton.position.set(16, 16)

    const reelsWidth = Math.min(screenWidth - 32, screenHeight * 0.32 * (5 / 3))
    const reelsHeight = reelsWidth / (5 / 3)

    this.reels.layout(reelsWidth, reelsHeight)
    this.reels.position.set((screenWidth - reelsWidth) / 2, screenHeight * 0.26)

    this.winLabel.position.set(screenWidth / 2, screenHeight * 0.26 + reelsHeight + 24)

    this.spinButton.position.set((screenWidth - this.spinButton.width) / 2, screenHeight * 0.8 - this.spinButton.height)
    this.autospinToggleButton.position.set(
      (screenWidth - this.autospinToggleButton.width) / 2 - this.spinButton.width / 2 - 40,
      screenHeight * 0.8 - this.autospinToggleButton.height
    )

    this.betPanel.position.set(screenWidth / 2, screenHeight * 0.87)
    this.creditLabel.position.set(screenWidth / 2, screenHeight * 0.95)
  }
}
