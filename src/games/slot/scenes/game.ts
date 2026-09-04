import { inject, injectable } from 'inversify'
import { Assets, Container, Sprite } from 'pixi.js'
import { LOGO_ALIAS } from 'src/games/slot/assets'
import { DESIGN_HEIGHT, DESIGN_WIDTH, REELS_FRAME_HEIGHT, REELS_FRAME_WIDTH, REELS_MACHINE_MAX_SCALE } from 'src/games/slot/constants'
import type { BackgroundController } from 'src/games/slot/controllers/background'
import type { BetPanelController } from 'src/games/slot/controllers/hud/bet-panel'
import type { CreditLabelController } from 'src/games/slot/controllers/hud/credit-label'
import type { GameModePanelController } from 'src/games/slot/controllers/hud/game-mode-panel'
import type { SoundToggleButtonController } from 'src/games/slot/controllers/hud/sound-toggle-button'
import type { SpinButtonController } from 'src/games/slot/controllers/hud/spin-button'
import type { WinLabelController } from 'src/games/slot/controllers/hud/win-label'
import type { ReelsMachineController } from 'src/games/slot/controllers/reels/reels-machine'
import { SLOT_TOKENS } from 'src/games/slot/tokens'

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
  private readonly spinButton: SpinButtonController
  private readonly soundToggleButton: SoundToggleButtonController
  private readonly winLabel: WinLabelController
  private readonly betPanel: BetPanelController
  private readonly gameModePanel: GameModePanelController
  private readonly creditLabel: CreditLabelController

  constructor(
    @inject(SLOT_TOKENS.BackgroundController) background: BackgroundController,
    @inject(SLOT_TOKENS.ReelsMachineController) reelsMachine: ReelsMachineController,
    @inject(SLOT_TOKENS.SpinButtonController) spinButton: SpinButtonController,
    @inject(SLOT_TOKENS.SoundToggleButtonController) soundToggleButton: SoundToggleButtonController,
    @inject(SLOT_TOKENS.WinLabelController) winLabel: WinLabelController,
    @inject(SLOT_TOKENS.BetPanelController) betPanel: BetPanelController,
    @inject(SLOT_TOKENS.GameModePanelController) gameModePanel: GameModePanelController,
    @inject(SLOT_TOKENS.CreditLabelController) creditLabel: CreditLabelController
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
