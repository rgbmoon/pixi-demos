import { inject, injectable } from 'inversify'
import { Assets, Sprite, type Texture } from 'pixi.js'
import { TOKENS } from 'src/constants/tokens'
import { Label, LabelColor } from 'src/game/ui/label'
import { LiveContainer } from 'src/game/ui/live-container'
import { formatAmount } from 'src/game/utils'
import type { SceneStore } from 'src/stores/scene-store'

import type { BetMinusButton } from './bet-minus-button'
import type { BetPlusButton } from './bet-plus-button'

const PLATE_SRC = '/src/assets/game/graphic/AL_Gamble_buttons/plate-bg.svg'
const PLATE_WIDTH = 180
const PLATE_HEIGHT = 64
const BUTTON_GAP = 8
const CAPTION_SIZE = 16
const VALUE_SIZE = 20
const TEXT_SPLIT_Y = -4

/**
 * Панель ставки
 */
@injectable()
export class BetPanel extends LiveContainer {
  private readonly plate = new Sprite()
  private readonly caption = new Label({ color: LabelColor.gold, fontSize: CAPTION_SIZE, text: 'BET' })
  private readonly value = new Label({ color: LabelColor.white, fontSize: VALUE_SIZE })

  constructor(
    @inject(TOKENS.SceneStore) sceneStore: SceneStore,
    @inject(TOKENS.BetMinusButton) minusButton: BetMinusButton,
    @inject(TOKENS.BetPlusButton) plusButton: BetPlusButton
  ) {
    super()

    this.plate.anchor.set(0.5)

    this.caption.anchor.set(0.5, 1)
    this.caption.position.set(0, TEXT_SPLIT_Y)
    this.value.anchor.set(0.5, 0)
    this.value.position.set(0, TEXT_SPLIT_Y)

    minusButton.position.set(-(PLATE_WIDTH / 2 + BUTTON_GAP + minusButton.sizePx), -minusButton.sizePx / 2)
    plusButton.position.set(PLATE_WIDTH / 2 + BUTTON_GAP, -plusButton.sizePx / 2)

    this.addChild(this.plate, this.caption, this.value, minusButton, plusButton)

    this.watch(
      () => sceneStore.bet,
      (bet) => {
        this.value.text = formatAmount(bet)
      },
      { fireImmediately: true }
    )

    void this.loadPlate()
  }

  private async loadPlate(): Promise<void> {
    const texture = await Assets.load<Texture>(PLATE_SRC)

    if (this.destroyed) return

    this.plate.texture = texture
    this.plate.setSize(PLATE_WIDTH, PLATE_HEIGHT)
  }
}
