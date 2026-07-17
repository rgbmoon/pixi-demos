import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import { Button, ButtonSize, ButtonVariant } from 'src/game/ui/button'
import type { SceneStore } from 'src/stores/scene-store'

const AUTOSPIN_ON_ICON = '/src/assets/game/graphic/Icons/square-svgrepo-com.svg'
const AUTOSPIN_OFF_ICON = '/src/assets/game/graphic/Icons/play-svgrepo-com.svg'

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
      icon: AUTOSPIN_OFF_ICON,
    })

    this.sceneStore = sceneStore

    this.on('pointertap', this.handleTap)

    this.watch(
      () => this.sceneStore.isAutospin,
      (isAutospin) => {
        this.active = isAutospin
        void this.setIcon(isAutospin ? AUTOSPIN_ON_ICON : AUTOSPIN_OFF_ICON)
      },
      { fireImmediately: true }
    )
  }

  private handleTap = () => {
    this.sceneStore.toggleAutospin()
  }
}
