import { inject, injectable } from 'inversify'
import { Container } from 'pixi.js'
import { TOKENS } from 'src/constants/tokens'
import { REELS_FRAME_HEIGHT, REELS_FRAME_WIDTH, REELS_MACHINE_MAX_SCALE } from 'src/game/constants'
import type { ReelsMachineController } from 'src/game/controllers/reels-machine'

import type { BackgroundController } from '../controllers/background'
import type { BetPanel } from '../controllers/bet-panel'
import type { CreditLabel } from '../controllers/credit-label'
import type { ForegroundController } from '../controllers/foreground'
import type { GameModePanel } from '../controllers/game-mode-panel'
import type { SoundToggleButton } from '../controllers/sound-toggle-button'
import type { SpinButton } from '../controllers/spin-button'
import type { WinLabel } from '../controllers/win-label'

const SCREEN_MARGIN = 16
const BOTTOM_MARGIN = 16
const PANEL_GAP = 40
const WIN_LABEL_GAP = 16
const REELS_TOP_MARGIN = 32
const CREDIT_HEIGHT = 30
const WIN_LABEL_HEIGHT = 30

/**
 * Сцена игры: собирает контроллеры в дерево отображения и расставляет их по экрану.
 * Новый контроллер подключается здесь и в bindings.ts.
 */
@injectable()
export class GameScene extends Container {
  private readonly background: BackgroundController
  private readonly reelsMachine: ReelsMachineController
  private readonly spinButton: SpinButton
  private readonly soundToggleButton: SoundToggleButton
  private readonly winLabel: WinLabel
  private readonly betPanel: BetPanel
  private readonly gameModePanel: GameModePanel
  private readonly creditLabel: CreditLabel
  private readonly foreground: ForegroundController

  constructor(
    @inject(TOKENS.BackgroundController) background: BackgroundController,
    @inject(TOKENS.ReelsMachineController) reelsMachine: ReelsMachineController,
    @inject(TOKENS.SpinButton) spinButton: SpinButton,
    @inject(TOKENS.SoundToggleButton) soundToggleButton: SoundToggleButton,
    @inject(TOKENS.WinLabel) winLabel: WinLabel,
    @inject(TOKENS.BetPanel) betPanel: BetPanel,
    @inject(TOKENS.GameModePanel) gameModePanel: GameModePanel,
    @inject(TOKENS.CreditLabel) creditLabel: CreditLabel,
    @inject(TOKENS.ForegroundController) foreground: ForegroundController
  ) {
    super()

    this.background = background
    this.reelsMachine = reelsMachine
    this.spinButton = spinButton
    this.soundToggleButton = soundToggleButton
    this.winLabel = winLabel
    this.betPanel = betPanel
    this.gameModePanel = gameModePanel
    this.creditLabel = creditLabel
    this.foreground = foreground

    // Передний слой фона идёт после машины барабанов и перекрывает её; HUD остаётся поверх обоих
    this.addChild(
      background,
      reelsMachine,
      foreground,
      spinButton,
      soundToggleButton,
      winLabel,
      betPanel,
      gameModePanel,
      creditLabel
    )
  }

  layout(screenWidth: number, screenHeight: number): void {
    this.background.layout(screenWidth, screenHeight)
    this.foreground.layout(screenWidth, screenHeight)

    const centerX = screenWidth / 2

    this.soundToggleButton.position.set(SCREEN_MARGIN, SCREEN_MARGIN)

    // Ряд управления: спин по центру, плашки настроек по бокам от него
    const controlsCenterY = screenHeight - BOTTOM_MARGIN - this.spinButton.sizePx / 2
    const panelOffsetX = this.spinButton.sizePx / 2 + PANEL_GAP

    this.spinButton.position.set(centerX - this.spinButton.sizePx / 2, controlsCenterY - this.spinButton.sizePx / 2)
    this.betPanel.position.set(centerX - panelOffsetX - this.betPanel.widthPx / 2, controlsCenterY)
    this.gameModePanel.position.set(centerX + panelOffsetX + this.gameModePanel.widthPx / 2, controlsCenterY)

    // Машина занимает поле между строкой кредита и строкой выигрыша над рядом управления
    const playAreaTop = SCREEN_MARGIN + CREDIT_HEIGHT + REELS_TOP_MARGIN
    const playAreaBottom =
      controlsCenterY - this.spinButton.sizePx / 2 - WIN_LABEL_GAP - WIN_LABEL_HEIGHT - WIN_LABEL_GAP
    const playAreaHeight = playAreaBottom - playAreaTop

    const reelsScale = Math.min(
      REELS_MACHINE_MAX_SCALE,
      playAreaHeight / REELS_FRAME_HEIGHT,
      (screenWidth - 2 * SCREEN_MARGIN) / REELS_FRAME_WIDTH
    )
    const reelsCenterY = playAreaTop + playAreaHeight / 2
    const reelsHalfHeight = (REELS_FRAME_HEIGHT * reelsScale) / 2

    this.reelsMachine.scale.set(reelsScale)
    this.reelsMachine.position.set(centerX, reelsCenterY)

    // Строка кредита делит пополам просвет между верхом канваса и рамкой барабанов
    this.creditLabel.position.set(centerX, (reelsCenterY - reelsHalfHeight) / 2)

    this.winLabel.position.set(centerX, reelsCenterY + reelsHalfHeight + WIN_LABEL_GAP + WIN_LABEL_HEIGHT / 2)
  }
}
