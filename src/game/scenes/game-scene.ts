import { inject, injectable } from 'inversify'
import { Assets, Container, Sprite } from 'pixi.js'
import { TOKENS } from 'src/constants/tokens'
import type { ReelsMachineController } from 'src/game/controllers/reels-machine'

import type { AutospinToggleButton } from '../controllers/autospin-toggle-button'
import type { BackgroundController } from '../controllers/background'
import type { BetPanel } from '../controllers/bet-panel'
import type { CreditLabel } from '../controllers/credit-label'
import type { LoadingScreen } from '../controllers/loading-screen'
import type { SoundToggleButton } from '../controllers/sound-toggle-button'
import type { SpinButton } from '../controllers/spin-button'
import type { WinLabel } from '../controllers/win-label'

const SCREEN_MARGIN = 16
const BOTTOM_MARGIN = 32
const CONTROLS_GAP = 16
const AUTOSPIN_GAP = 16
const WIN_LABEL_GAP = 24

const LOGO_TOP = 32
const LOGO_SCALE = 0.4

// Высоты рядов на экране. Объявлены здесь, потому что bounds до загрузки ассетов нулевые,
// а layout вызывается раньше: логотип 593 × 315 при LOGO_SCALE, строка кредита 16 + 4 + 20
// (credit-label.ts), панель ставки — md-кнопки по бокам (bet-panel.ts), рамка 639.96 при SCALE 0.4
// (reels-machine.ts).
const LOGO_HEIGHT = 315 * LOGO_SCALE
const CREDIT_HEIGHT = 40
const BET_PANEL_HEIGHT = 65
const REELS_HEIGHT = 256

/**
 * Сцена игры: собирает контроллеры в дерево отображения и расставляет их по экрану.
 * Новый контроллер подключается здесь и в bindings.ts.
 */
@injectable()
export class GameScene extends Container {
  private readonly background: BackgroundController
  private readonly logo = new Sprite()
  private readonly reelsMachine: ReelsMachineController
  private readonly spinButton: SpinButton
  private readonly soundToggleButton: SoundToggleButton
  private readonly autospinToggleButton: AutospinToggleButton
  private readonly winLabel: WinLabel
  private readonly betPanel: BetPanel
  private readonly creditLabel: CreditLabel
  private readonly loadingScreen: LoadingScreen

  constructor(
    @inject(TOKENS.BackgroundController) background: BackgroundController,
    @inject(TOKENS.ReelsMachineController) reelsMachine: ReelsMachineController,
    @inject(TOKENS.SpinButton) spinButton: SpinButton,
    @inject(TOKENS.SoundToggleButton) soundToggleButton: SoundToggleButton,
    @inject(TOKENS.AutospinToggleButton) autospinToggleButton: AutospinToggleButton,
    @inject(TOKENS.WinLabel) winLabel: WinLabel,
    @inject(TOKENS.BetPanel) betPanel: BetPanel,
    @inject(TOKENS.CreditLabel) creditLabel: CreditLabel,
    @inject(TOKENS.LoadingScreen) loadingScreen: LoadingScreen
  ) {
    super()

    this.background = background
    this.reelsMachine = reelsMachine
    this.spinButton = spinButton
    this.soundToggleButton = soundToggleButton
    this.autospinToggleButton = autospinToggleButton
    this.winLabel = winLabel
    this.betPanel = betPanel
    this.creditLabel = creditLabel
    this.loadingScreen = loadingScreen

    this.addChild(
      background,
      this.logo,
      reelsMachine,
      spinButton,
      soundToggleButton,
      autospinToggleButton,
      winLabel,
      betPanel,
      creditLabel,
      loadingScreen
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

    const centerX = screenWidth / 2

    this.soundToggleButton.position.set(SCREEN_MARGIN, SCREEN_MARGIN)

    this.logo.anchor.set(0.5, 0)
    this.logo.scale.set(LOGO_SCALE)
    this.logo.position.set(centerX, LOGO_TOP)

    this.creditLabel.position.set(centerX, screenHeight - BOTTOM_MARGIN - CREDIT_HEIGHT / 2)
    this.betPanel.position.set(centerX, this.creditLabel.y - CREDIT_HEIGHT / 2 - CONTROLS_GAP - BET_PANEL_HEIGHT / 2)

    const buttonsCenterY = this.betPanel.y - BET_PANEL_HEIGHT / 2 - CONTROLS_GAP - this.spinButton.sizePx / 2

    this.spinButton.position.set(centerX - this.spinButton.sizePx / 2, buttonsCenterY - this.spinButton.sizePx / 2)
    this.autospinToggleButton.position.set(
      this.spinButton.x - AUTOSPIN_GAP - this.autospinToggleButton.sizePx,
      buttonsCenterY - this.autospinToggleButton.sizePx / 2
    )

    const playAreaTop = LOGO_TOP + LOGO_HEIGHT
    const playAreaBottom = buttonsCenterY - this.spinButton.sizePx / 2

    this.reelsMachine.position.set(centerX, (playAreaTop + playAreaBottom) / 2)

    this.winLabel.position.set(centerX, this.reelsMachine.y + REELS_HEIGHT / 2 + WIN_LABEL_GAP)

    this.loadingScreen.layout(screenWidth, screenHeight)
  }
}
