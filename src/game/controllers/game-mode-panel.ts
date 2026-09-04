import { inject, injectable } from 'inversify'
import { Assets, Sprite } from 'pixi.js'
import { TOKENS } from 'src/constants/tokens'
import { PLATE_SRC } from 'src/game/assets'
import { Label, LabelColor } from 'src/game/ui/label'
import { LiveContainer } from 'src/game/ui/live-container'
import type { SceneStore } from 'src/stores/scene-store'

import type { GameModeMinusButton } from './game-mode-minus-button'
import type { GameModePlusButton } from './game-mode-plus-button'

const PLATE_WIDTH = 360
const PLATE_HEIGHT = 128
const BUTTON_GAP = 16
const CAPTION_SIZE = 32
const VALUE_SIZE = 40

/**
 * Панель режима игры: показывает число линий, участвующих в раунде
 */
@injectable()
export class GameModePanel extends LiveContainer {

  private readonly plate = new Sprite()
  private readonly caption = new Label({ color: LabelColor.cyan, fontSize: CAPTION_SIZE, text: 'LINES' })
  private readonly value = new Label({ color: LabelColor.white, fontSize: VALUE_SIZE })

  constructor(
    @inject(TOKENS.SceneStore) sceneStore: SceneStore,
    @inject(TOKENS.GameModeMinusButton) minusButton: GameModeMinusButton,
    @inject(TOKENS.GameModePlusButton) plusButton: GameModePlusButton
  ) {
    super()


    this.plate.anchor.set(0.5)
    this.plate.texture = Assets.get(PLATE_SRC)
    this.plate.setSize(PLATE_WIDTH, PLATE_HEIGHT)

    this.caption.anchor.set(0.5, 0)
    this.value.anchor.set(0.5, 0)

    minusButton.position.set(-(PLATE_WIDTH / 2 + BUTTON_GAP + minusButton.sizeUnits), -minusButton.sizeUnits / 2)
    plusButton.position.set(PLATE_WIDTH / 2 + BUTTON_GAP, -plusButton.sizeUnits / 2)

    this.addChild(this.plate, this.caption, this.value, minusButton, plusButton)

    this.watch(
      () => sceneStore.lines,
      (lines) => {
        this.value.text = String(lines)

        this.layoutText()
      },
      { fireImmediately: true }
    )
  }

  /** Центрирует пару строк по высоте плашки: обе меряются по фактическому кеглю шрифта. */
  private layoutText(): void {
    const totalHeight = this.caption.height + this.value.height

    this.caption.position.set(0, -totalHeight / 2)
    this.value.position.set(0, -totalHeight / 2 + this.caption.height)
  }
}
