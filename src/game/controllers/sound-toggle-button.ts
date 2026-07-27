import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import { BUTTON_ICONS } from 'src/game/assets'
import { Button, ButtonSize, ButtonVariant } from 'src/game/ui/button'
import type { SceneStore } from 'src/stores/scene-store'

/**
 * Кнопка отключения/включения звука
 */
@injectable()
export class SoundToggleButton extends Button {
  private readonly sceneStore: SceneStore

  constructor(@inject(TOKENS.SceneStore) sceneStore: SceneStore) {
    super({
      variant: ButtonVariant.romb,
      size: ButtonSize.md,
      icon: BUTTON_ICONS.soundOn,
    })

    this.sceneStore = sceneStore

    this.on('pointertap', this.handleTap)

    this.watch(
      () => this.sceneStore.isSoundOn,
      (on) => {
        this.active = !on
        this.setIcon(on ? BUTTON_ICONS.soundOn : BUTTON_ICONS.soundOff)
      },
      { fireImmediately: true }
    )
  }

  private handleTap = () => {
    this.sceneStore.toggleSound()
  }
}
