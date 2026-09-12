import { inject, injectable } from 'inversify'
import { Assets, Container, Sprite } from 'pixi.js'
import { LOGO_ALIAS } from 'src/games/slot/assets'
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  REELS_FRAME_HEIGHT,
  REELS_FRAME_WIDTH,
  REELS_MACHINE_MAX_SCALE,
  SCREEN_MARGIN,
} from 'src/games/slot/constants'
import type { BackgroundController } from 'src/games/slot/controllers/background'
import type { BetPanelController } from 'src/games/slot/controllers/hud/bet-panel'
import type { CreditLabelController } from 'src/games/slot/controllers/hud/credit-label'
import type { SettingsButtonController } from 'src/games/slot/controllers/hud/settings-button'
import type { SettingsModalController } from 'src/games/slot/controllers/hud/settings-modal'
import type { SoundToggleButtonController } from 'src/games/slot/controllers/hud/sound-toggle-button'
import type { SpinButtonController } from 'src/games/slot/controllers/hud/spin-button'
import type { WinLabelController } from 'src/games/slot/controllers/hud/win-label'
import type { HoldWinController } from 'src/games/slot/controllers/reels/hold-win'
import type { ReelsMachineController } from 'src/games/slot/controllers/reels/reels-machine'
import type { SoundController } from 'src/games/slot/controllers/sound'
import { SLOT_TOKENS } from 'src/games/slot/tokens'

// Все размеры ниже — дизайн-единицы макета 941×1672, а не пиксели канваса
const BOTTOM_MARGIN = 32
const CONTROLS_GAP = 20
const WIN_LABEL_GAP = 24

const LOGO_TOP = 16
const LOGO_WIDTH = 420

// Высоты рядов на экране. Объявлены здесь, потому что bounds лейблов до первой отрисовки текста
// нулевые, а layout вызывается раньше: логотип — арт 1672×941 при LOGO_WIDTH, строки кредита и
// выигрыша — кегль лейблов, плашка панели ставки — bet-panel.ts.
const LOGO_HEIGHT = (LOGO_WIDTH * 941) / 1672
const CREDIT_HEIGHT = 60
const BET_PANEL_HEIGHT = 128
const WIN_LABEL_HEIGHT = 60

/**
 * Сцена игры: собирает контроллеры в дерево отображения и расставляет их по экрану.
 * Раскладка ведётся в дизайн-единицах макета: контент вписывается в канвас целиком и центрируется,
 * фон масштабируется до полного покрытия. Новый контроллер подключается здесь и в bindings.ts.
 */
@injectable()
export class GameScene extends Container {
  // Пропорции канваса могут отличаться от макета, поэтому фон и контент масштабируются раздельно
  private readonly background: BackgroundController
  private readonly content = new Container()
  private readonly logo = new Sprite()
  private readonly reelsMachine: ReelsMachineController
  private readonly holdWin: HoldWinController
  private readonly spinButton: SpinButtonController
  private readonly soundToggleButton: SoundToggleButtonController
  private readonly settingsButton: SettingsButtonController
  private readonly winLabel: WinLabelController
  private readonly betPanel: BetPanelController
  private readonly creditLabel: CreditLabelController
  private readonly settingsModal: SettingsModalController

  constructor(
    @inject(SLOT_TOKENS.BackgroundController) background: BackgroundController,
    @inject(SLOT_TOKENS.ReelsMachineController) reelsMachine: ReelsMachineController,
    @inject(SLOT_TOKENS.HoldWinController) holdWin: HoldWinController,
    @inject(SLOT_TOKENS.SpinButtonController) spinButton: SpinButtonController,
    @inject(SLOT_TOKENS.SoundToggleButtonController) soundToggleButton: SoundToggleButtonController,
    @inject(SLOT_TOKENS.SettingsButtonController) settingsButton: SettingsButtonController,
    @inject(SLOT_TOKENS.WinLabelController) winLabel: WinLabelController,
    @inject(SLOT_TOKENS.BetPanelController) betPanel: BetPanelController,
    @inject(SLOT_TOKENS.CreditLabelController) creditLabel: CreditLabelController,
    @inject(SLOT_TOKENS.SettingsModalController) settingsModal: SettingsModalController,
    @inject(SLOT_TOKENS.SoundController) sound: SoundController
  ) {
    super()

    this.background = background
    this.reelsMachine = reelsMachine
    this.holdWin = holdWin
    this.spinButton = spinButton
    this.soundToggleButton = soundToggleButton
    this.settingsButton = settingsButton
    this.winLabel = winLabel
    this.betPanel = betPanel
    this.creditLabel = creditLabel
    this.settingsModal = settingsModal

    this.logo.texture = Assets.get(LOGO_ALIAS)
    this.logo.anchor.set(0.5, 0)
    this.logo.setSize(LOGO_WIDTH, LOGO_HEIGHT)

    this.content.addChild(
      this.logo,
      reelsMachine,
      holdWin,
      spinButton,
      soundToggleButton,
      settingsButton,
      winLabel,
      betPanel,
      creditLabel,
      settingsModal
    )

    // Звук места на экране не занимает: в дереве он ради владения, layout его не расставляет
    this.addChild(background, this.content, sound)
  }

  layout(screenWidth: number, screenHeight: number): void {
    // Фон масштабируется до полного покрытия канваса с обрезкой по краям, контент — до вписывания
    const coverScale = Math.max(screenWidth / DESIGN_WIDTH, screenHeight / DESIGN_HEIGHT)
    const contentScale = Math.min(screenWidth / DESIGN_WIDTH, screenHeight / DESIGN_HEIGHT)

    this.background.scale.set(coverScale)
    this.background.position.set(
      (screenWidth - DESIGN_WIDTH * coverScale) / 2,
      (screenHeight - DESIGN_HEIGHT * coverScale) / 2
    )

    this.content.scale.set(contentScale)
    this.content.position.set(
      (screenWidth - DESIGN_WIDTH * contentScale) / 2,
      (screenHeight - DESIGN_HEIGHT * contentScale) / 2
    )

    // Видимая область в дизайн-единицах: при пропорциях канваса, отличных от макета, она симметрично
    // выходит за макет. Элементы у края экрана позиционируются от её границ
    const viewWidth = screenWidth / contentScale
    const viewHeight = screenHeight / contentScale
    const viewLeft = (DESIGN_WIDTH - viewWidth) / 2
    const viewTop = (DESIGN_HEIGHT - viewHeight) / 2
    const viewRight = viewLeft + viewWidth
    const viewBottom = viewTop + viewHeight

    const centerX = DESIGN_WIDTH / 2

    this.soundToggleButton.position.set(viewLeft + SCREEN_MARGIN, viewTop + SCREEN_MARGIN)
    this.settingsButton.position.set(viewRight - SCREEN_MARGIN - this.settingsButton.sizeUnits, viewTop + SCREEN_MARGIN)

    this.logo.position.set(centerX, viewTop + LOGO_TOP)

    // Нижний блок собирается снизу вверх: кредит, панель ставки, кнопка спина
    this.creditLabel.position.set(centerX, viewBottom - BOTTOM_MARGIN - CREDIT_HEIGHT / 2)
    this.betPanel.position.set(centerX, this.creditLabel.y - CREDIT_HEIGHT / 2 - CONTROLS_GAP - BET_PANEL_HEIGHT / 2)

    const spinCenterY = this.betPanel.y - BET_PANEL_HEIGHT / 2 - CONTROLS_GAP - this.spinButton.sizeUnits / 2

    this.spinButton.position.set(centerX - this.spinButton.sizeUnits / 2, spinCenterY - this.spinButton.sizeUnits / 2)

    // Машина занимает поле между логотипом и рядом управления, снизу от неё — строка выигрыша
    const playAreaTop = viewTop + LOGO_TOP + LOGO_HEIGHT
    const playAreaBottom = spinCenterY - this.spinButton.sizeUnits / 2
    const winRowHeight = WIN_LABEL_GAP + WIN_LABEL_HEIGHT + WIN_LABEL_GAP
    const playAreaHeight = playAreaBottom - playAreaTop - winRowHeight

    const reelsScale = Math.min(
      REELS_MACHINE_MAX_SCALE,
      playAreaHeight / REELS_FRAME_HEIGHT,
      (viewWidth - 2 * SCREEN_MARGIN) / REELS_FRAME_WIDTH
    )
    const reelsCenterY = playAreaTop + playAreaHeight / 2
    const reelsHalfHeight = (REELS_FRAME_HEIGHT * reelsScale) / 2

    this.reelsMachine.scale.set(reelsScale)
    this.reelsMachine.position.set(centerX, reelsCenterY)

    // Доска бонуса подменяет машину на том же месте и в том же масштабе
    this.holdWin.scale.set(reelsScale)
    this.holdWin.position.set(centerX, reelsCenterY)

    this.winLabel.position.set(centerX, reelsCenterY + reelsHalfHeight + WIN_LABEL_GAP + WIN_LABEL_HEIGHT / 2)

    this.settingsModal.layout(viewLeft, viewTop, viewWidth, viewHeight)
  }
}
