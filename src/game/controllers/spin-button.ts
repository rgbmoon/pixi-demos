import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import type { GameEmitter } from 'src/events/game-emitter'
import type { GameEvents } from 'src/events/types'
import { BUTTON_ICONS } from 'src/game/assets'
import { Button, ButtonSize, ButtonVariant } from 'src/game/ui/button'
import type { SceneStore } from 'src/stores/scene-store'

/**
 * Кнопка запуска спина: по тапу объявляет `ui:spinRequested` с текущей ставкой;
 * доступность следует за `sceneStore.canSpin`.
 */
@injectable()
export class SpinButton extends Button {
  private readonly emitter: GameEmitter<GameEvents>
  private readonly sceneStore: SceneStore

  constructor(
    @inject(TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(TOKENS.SceneStore) sceneStore: SceneStore
  ) {
    super({
      variant: ButtonVariant.circle,
      size: ButtonSize.lg,
      icon: BUTTON_ICONS.spin,
      iconRatio: 0.6,
    })

    this.emitter = emitter
    this.sceneStore = sceneStore

    this.on('pointertap', this.handleTap)

    this.watch(
      () => this.sceneStore.canSpin,
      (canSpin) => this.setEnabled(canSpin),
      { fireImmediately: true }
    )
  }

  private handleTap = () => {
    this.emitter.emit('ui:spinRequested', { bet: this.sceneStore.bet })
  }
}
