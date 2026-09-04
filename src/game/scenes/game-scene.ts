import { inject, injectable } from 'inversify'
import { Assets, Container, Sprite } from 'pixi.js'
import { TOKENS } from 'src/constants/tokens'
import { LOGO_ALIAS } from 'src/game/assets'
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  REELS_FRAME_HEIGHT,
  REELS_FRAME_WIDTH,
  REELS_MACHINE_MAX_SCALE,
} from 'src/game/constants'
import type { ReelsMachineController } from 'src/game/controllers/reels-machine'

import type { BackgroundController } from '../controllers/background'
import type { BetPanel } from '../controllers/bet-panel'
import type { CreditLabel } from '../controllers/credit-label'
import type { GameModePanel } from '../controllers/game-mode-panel'
import type { SoundToggleButton } from '../controllers/sound-toggle-button'
import type { SpinButton } from '../controllers/spin-button'
import type { WinLabel } from '../controllers/win-label'

// Все размеры ниже — дизайн-единицы макета 941×1672, а не пиксели канваса
const SCREEN_MARGIN = 32
const BOTTOM_MARGIN = 32
const CONTROLS_GAP = 20
const WIN_LABEL_GAP = 24

const LOGO_TOP = 16
const LOGO_WIDTH = 420

// Высоты рядов на экране. Объявлены здесь, потому что bounds лейблов до первой отрисовки текста
// нулевые, а layout вызывается раньше: логотип — арт 1672×941 при LOGO_WIDTH, строки кредита и
// выигрыша — кегль лейблов, плашки панелей — bet-panel.ts и game-mode-panel.ts.
const LOGO_HEIGHT = (LOGO_WIDTH * 941) / 1672
const CREDIT_HEIGHT = 60
const BET_PANEL_HEIGHT = 128
const GAME_MODE_PANEL_HEIGHT = 128
const WIN_LABEL_HEIGHT = 60

/**
 * Сцена игры: собирает контроллеры в дерево отображения и расставляет их по экрану.
 * Раскладка ведётся в дизайн-единицах макета, под канвас масштабируется вся сцена целиком.
 * Новый контроллер подключается здесь и в bindings.ts.
 */
@injectable()
export class GameScene extends Container {
  private readonly logo = new Sprite()
  private readonly reelsMachine: ReelsMachineController
  private readonly spinButton: SpinButton
  private readonly soundToggleButton: SoundToggleButton
  private readonly winLabel: WinLabel
  private readonly betPanel: BetPanel
  private readonly gameModePanel: GameModePanel
  private readonly creditLabel: CreditLabel

  constructor(
    @inject(TOKENS.BackgroundController) background: BackgroundController,
    @inject(TOKENS.ReelsMachineController) reelsMachine: ReelsMachineController,
    @inject(TOKENS.SpinButton) spinButton: SpinButton,
    @inject(TOKENS.SoundToggleButton) soundToggleButton: SoundToggleButton,
    @inject(TOKENS.WinLabel) winLabel: WinLabel,
    @inject(TOKENS.BetPanel) betPanel: BetPanel,
    @inject(TOKENS.GameModePanel) gameModePanel: GameModePanel,
    @inject(TOKENS.CreditLabel) creditLabel: CreditLabel
  ) {
    super()

    // Фон в раскладке не участвует: арт нарисован в размер макета и стоит в его начале координат
    this.reelsMachine = reelsMachine
    this.spinButton = spinButton
    this.soundToggleButton = soundToggleButton
    this.winLabel = winLabel
    this.betPanel = betPanel
    this.gameModePanel = gameModePanel
    this.creditLabel = creditLabel

    this.logo.texture = Assets.get(LOGO_ALIAS)
    this.logo.anchor.set(0.5, 0)
    this.logo.setSize(LOGO_WIDTH, LOGO_HEIGHT)

    this.addChild(
      background,
      this.logo,
      reelsMachine,
      spinButton,
      soundToggleButton,
      winLabel,
      betPanel,
      gameModePanel,
      creditLabel
    )
  }

  layout(screenWidth: number, screenHeight: number): void {
    // Канвас повторяет пропорции макета, поэтому по обеим осям выходит один и тот же множитель
    this.scale.set(Math.min(screenWidth / DESIGN_WIDTH, screenHeight / DESIGN_HEIGHT))

    const centerX = DESIGN_WIDTH / 2

    this.soundToggleButton.position.set(SCREEN_MARGIN, SCREEN_MARGIN)

    this.logo.position.set(centerX, LOGO_TOP)

    // Нижний блок собирается снизу вверх: кредит, панель режима, панель ставки, кнопка спина
    this.creditLabel.position.set(centerX, DESIGN_HEIGHT - BOTTOM_MARGIN - CREDIT_HEIGHT / 2)
    this.gameModePanel.position.set(
      centerX,
      this.creditLabel.y - CREDIT_HEIGHT / 2 - CONTROLS_GAP - GAME_MODE_PANEL_HEIGHT / 2
    )
    this.betPanel.position.set(
      centerX,
      this.gameModePanel.y - GAME_MODE_PANEL_HEIGHT / 2 - CONTROLS_GAP - BET_PANEL_HEIGHT / 2
    )

    const spinCenterY = this.betPanel.y - BET_PANEL_HEIGHT / 2 - CONTROLS_GAP - this.spinButton.sizeUnits / 2

    this.spinButton.position.set(
      centerX - this.spinButton.sizeUnits / 2,
      spinCenterY - this.spinButton.sizeUnits / 2
    )

    // Машина занимает поле между логотипом и рядом управления, снизу от неё — строка выигрыша
    const playAreaTop = LOGO_TOP + LOGO_HEIGHT
    const playAreaBottom = spinCenterY - this.spinButton.sizeUnits / 2
    const winRowHeight = WIN_LABEL_GAP + WIN_LABEL_HEIGHT + WIN_LABEL_GAP
    const playAreaHeight = playAreaBottom - playAreaTop - winRowHeight

    const reelsScale = Math.min(
      REELS_MACHINE_MAX_SCALE,
      playAreaHeight / REELS_FRAME_HEIGHT,
      (DESIGN_WIDTH - 2 * SCREEN_MARGIN) / REELS_FRAME_WIDTH
    )
    const reelsCenterY = playAreaTop + playAreaHeight / 2
    const reelsHalfHeight = (REELS_FRAME_HEIGHT * reelsScale) / 2

    this.reelsMachine.scale.set(reelsScale)
    this.reelsMachine.position.set(centerX, reelsCenterY)

    this.winLabel.position.set(centerX, reelsCenterY + reelsHalfHeight + WIN_LABEL_GAP + WIN_LABEL_HEIGHT / 2)
  }
}
