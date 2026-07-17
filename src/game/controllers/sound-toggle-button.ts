import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import { Button, ButtonSize } from 'src/game/ui/button'
import type { SceneStore } from 'src/stores/scene-store'

const SOUND_ON_ICON = '/src/assets/game/graphic/Icons/sound-on-svgrepo-com.svg'
const SOUND_OFF_ICON = '/src/assets/game/graphic/Icons/sound-off-svgrepo-com.svg'

/**
 * Кнопка отключения/включения звука
 */
@injectable()
export class SoundToggleButton extends Button {
  private readonly sceneStore: SceneStore

  constructor(@inject(TOKENS.SceneStore) sceneStore: SceneStore) {
    super({ size: ButtonSize.md, icon: SOUND_ON_ICON })

    this.sceneStore = sceneStore

    this.on('pointertap', this.handleTap)

    this.watch(
      () => this.sceneStore.isSoundOn,
      (on) => {
        this.active = !on
        void this.setIcon(on ? SOUND_ON_ICON : SOUND_OFF_ICON)
      },
      { fireImmediately: true }
    )
  }

  private handleTap = () => {
    this.sceneStore.toggleSound()
  }
}
