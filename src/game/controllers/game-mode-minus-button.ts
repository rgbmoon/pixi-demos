import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import { BUTTON_ICONS } from 'src/game/assets'
import { Button, ButtonSize, ButtonVariant } from 'src/game/ui/button'
import type { SceneStore } from 'src/stores/scene-store'
import { StepDirection } from 'src/types/game'

/**
 * Кнопка перехода к режиму с меньшим числом линий
 */
@injectable()
export class GameModeMinusButton extends Button {
  private readonly sceneStore: SceneStore

  constructor(@inject(TOKENS.SceneStore) sceneStore: SceneStore) {
    super({
      variant: ButtonVariant.circle,
      size: ButtonSize.md,
      icon: BUTTON_ICONS.minus,
    })

    this.sceneStore = sceneStore

    this.on('pointertap', this.handleTap)

    this.watch(
      () => this.sceneStore.canStepGameMode(StepDirection.backward),
      (canStep) => this.setEnabled(canStep),
      { fireImmediately: true }
    )
  }

  private handleTap = () => {
    this.sceneStore.stepGameMode(StepDirection.backward)
  }
}
