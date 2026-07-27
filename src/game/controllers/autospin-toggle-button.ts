import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import { BUTTON_ICONS } from 'src/game/assets'
import { Button, ButtonSize, ButtonVariant } from 'src/game/ui/button'
import type { SceneStore } from 'src/stores/scene-store'

/**
 * Кнопка включения режима автоспинов.
 */
@injectable()
export class AutospinToggleButton extends Button {
  private readonly sceneStore: SceneStore

  constructor(@inject(TOKENS.SceneStore) sceneStore: SceneStore) {
    super({
      variant: ButtonVariant.romb,
      size: ButtonSize.md,
      icon: BUTTON_ICONS.autospinOff,
    })

    this.sceneStore = sceneStore

    this.on('pointertap', this.handleTap)

    this.watch(
      () => this.sceneStore.isAutospin,
      (isAutospin) => {
        this.active = isAutospin
        this.setIcon(isAutospin ? BUTTON_ICONS.autospinOn : BUTTON_ICONS.autospinOff)
      },
      { fireImmediately: true }
    )
  }

  private handleTap = () => {
    this.sceneStore.toggleAutospin()
  }
}
