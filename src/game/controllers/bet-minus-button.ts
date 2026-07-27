import { inject, injectable } from 'inversify'
import { BET_STEP } from 'src/constants/game'
import { TOKENS } from 'src/constants/tokens'
import { BUTTON_ICONS } from 'src/game/assets'
import { Button, ButtonSize, ButtonVariant } from 'src/game/ui/button'
import type { SceneStore } from 'src/stores/scene-store'

/**
 * Кнопка понижения ставки
 */
@injectable()
export class BetMinusButton extends Button {
  private readonly sceneStore: SceneStore

  constructor(@inject(TOKENS.SceneStore) sceneStore: SceneStore) {
    super({
      variant: ButtonVariant.circle,
      size: ButtonSize.md,
      icon: BUTTON_ICONS.betDown,
    })

    this.sceneStore = sceneStore

    this.on('pointertap', this.handleTap)
  }

  private handleTap = () => {
    this.sceneStore.setBet(this.sceneStore.bet - BET_STEP)
  }
}
