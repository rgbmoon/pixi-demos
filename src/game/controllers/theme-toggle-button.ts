import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import { Button, ButtonSize } from 'src/game/ui/button'
import type { SceneStore } from 'src/stores/scene-store'

const LIGHT_THEME_ICON = '/src/assets/game/graphic/Icons/sun-svgrepo-com.svg'
const DARK_THEME_ICON = '/src/assets/game/graphic/Icons/moon-svgrepo-com.svg'

/**
 * Кнопка переключения темы сцены.
 */
@injectable()
export class ThemeToggleButton extends Button {
  private readonly sceneStore: SceneStore

  constructor(@inject(TOKENS.SceneStore) sceneStore: SceneStore) {
    super({ size: ButtonSize.md, icon: DARK_THEME_ICON })

    this.sceneStore = sceneStore

    this.on('pointertap', this.handleTap)

    this.watch(
      () => this.sceneStore.theme,
      (theme) => {
        void this.setIcon(theme === 'light' ? DARK_THEME_ICON : LIGHT_THEME_ICON)
      },
      { fireImmediately: true }
    )
  }

  private handleTap = () => {
    this.sceneStore.toggleTheme()
  }
}
