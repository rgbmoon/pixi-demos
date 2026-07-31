import { inject, injectable } from 'inversify'
import { Assets, Container, Sprite } from 'pixi.js'
import { TOKENS } from 'src/constants/tokens'
import { LOGO_SRC } from 'src/game/assets'
import type { ReelsMachineController } from 'src/game/controllers/reels-machine'

import type { AutospinToggleButton } from '../controllers/autospin-toggle-button'
import type { BackgroundController } from '../controllers/background'
import type { BetPanel } from '../controllers/bet-panel'
import type { CreditLabel } from '../controllers/credit-label'
import type { GameModePanel } from '../controllers/game-mode-panel'
import type { SoundToggleButton } from '../controllers/sound-toggle-button'
import type { SpinButton } from '../controllers/spin-button'
import type { WinLabel } from '../controllers/win-label'

const SCREEN_MARGIN = 16
const BOTTOM_MARGIN = 16
const CONTROLS_GAP = 12
const AUTOSPIN_GAP = 16
const WIN_LABEL_GAP = 16

const LOGO_TOP = 8
const LOGO_SCALE = 0.4

// Высоты рядов на экране. Объявлены здесь, потому что bounds до загрузки ассетов нулевые,
// а layout вызывается раньше: логотип 593 × 315 при LOGO_SCALE, строка кредита 16 + 4 + 20
// (credit-label.ts), панель ставки — md-кнопки по бокам (bet-panel.ts), рамка 639.96 при SCALE 0.4
// (reels-machine.ts), строка выигрыша — кегль 24 (win-label.ts).
const LOGO_HEIGHT = 315 * LOGO_SCALE
const CREDIT_HEIGHT = 40
const BET_PANEL_HEIGHT = 65
const GAME_MODE_PANEL_HEIGHT = 65
const REELS_HEIGHT = 256
const WIN_LABEL_HEIGHT = 30

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
  private readonly gameModePanel: GameModePanel
  private readonly creditLabel: CreditLabel

  constructor(
    @inject(TOKENS.BackgroundController) background: BackgroundController,
    @inject(TOKENS.ReelsMachineController) reelsMachine: ReelsMachineController,
    @inject(TOKENS.SpinButton) spinButton: SpinButton,
    @inject(TOKENS.SoundToggleButton) soundToggleButton: SoundToggleButton,
    @inject(TOKENS.AutospinToggleButton) autospinToggleButton: AutospinToggleButton,
    @inject(TOKENS.WinLabel) winLabel: WinLabel,
    @inject(TOKENS.BetPanel) betPanel: BetPanel,
    @inject(TOKENS.GameModePanel) gameModePanel: GameModePanel,
    @inject(TOKENS.CreditLabel) creditLabel: CreditLabel
  ) {
    super()

    this.background = background
    this.reelsMachine = reelsMachine
    this.spinButton = spinButton
    this.soundToggleButton = soundToggleButton
    this.autospinToggleButton = autospinToggleButton
    this.winLabel = winLabel
    this.betPanel = betPanel
    this.gameModePanel = gameModePanel
    this.creditLabel = creditLabel

    this.logo.texture = Assets.get(LOGO_SRC)

    this.addChild(
      background,
      this.logo,
      reelsMachine,
      spinButton,
      soundToggleButton,
      autospinToggleButton,
      winLabel,
      betPanel,
      gameModePanel,
      creditLabel
    )
  }

  layout(screenWidth: number, screenHeight: number): void {
    this.background.layout(screenWidth, screenHeight)

    const centerX = screenWidth / 2

    this.soundToggleButton.position.set(SCREEN_MARGIN, SCREEN_MARGIN)

    this.logo.anchor.set(0.5, 0)
    this.logo.scale.set(LOGO_SCALE)
    this.logo.position.set(centerX, LOGO_TOP)

    this.creditLabel.position.set(centerX, screenHeight - BOTTOM_MARGIN - CREDIT_HEIGHT / 2)
    this.gameModePanel.position.set(
      centerX,
      this.creditLabel.y - CREDIT_HEIGHT / 2 - CONTROLS_GAP - GAME_MODE_PANEL_HEIGHT / 2
    )
    this.betPanel.position.set(
      centerX,
      this.gameModePanel.y - GAME_MODE_PANEL_HEIGHT / 2 - CONTROLS_GAP - BET_PANEL_HEIGHT / 2
    )

    const buttonsCenterY = this.betPanel.y - BET_PANEL_HEIGHT / 2 - CONTROLS_GAP - this.spinButton.sizePx / 2

    this.spinButton.position.set(centerX - this.spinButton.sizePx / 2, buttonsCenterY - this.spinButton.sizePx / 2)
    this.autospinToggleButton.position.set(
      this.spinButton.x - AUTOSPIN_GAP - this.autospinToggleButton.sizePx,
      buttonsCenterY - this.autospinToggleButton.sizePx / 2
    )

    const playAreaTop = LOGO_TOP + LOGO_HEIGHT
    const playAreaBottom = buttonsCenterY - this.spinButton.sizePx / 2

    const winRowHeight = WIN_LABEL_GAP + WIN_LABEL_HEIGHT
    const reelsCenterY = (playAreaTop + playAreaBottom - winRowHeight) / 2

    this.reelsMachine.position.set(centerX, reelsCenterY)

    this.winLabel.position.set(centerX, reelsCenterY + REELS_HEIGHT / 2 + WIN_LABEL_GAP + WIN_LABEL_HEIGHT / 2)
  }
}
