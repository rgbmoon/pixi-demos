import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import type { GameEmitter } from 'src/events/game-emitter'
import type { GameEvents } from 'src/events/types'
import { Button, ButtonSize, ButtonVariant } from 'src/game/ui/button'
import type { SpinStore } from 'src/stores/spin-store'

const SPIN_ICON = '/src/assets/game/graphic/Icons/arrow-cycle-svgrepo-com.svg'

/**
 * Кнопка запуска спина: по тапу объявляет `ui:spinRequested` с текущей ставкой;
 * доступность следует за `spinStore.canSpin`.
 */
@injectable()
export class SpinButton extends Button {
  private readonly emitter: GameEmitter<GameEvents>
  private readonly spinStore: SpinStore

  constructor(
    @inject(TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(TOKENS.SpinStore) spinStore: SpinStore
  ) {
    super({
      variant: ButtonVariant.circle,
      size: ButtonSize.lg,
      icon: SPIN_ICON,
      iconRatio: 0.6,
    })

    this.emitter = emitter
    this.spinStore = spinStore

    this.on('pointertap', this.handleTap)

    this.watch(
      () => this.spinStore.canSpin,
      (canSpin) => this.setEnabled(canSpin),
      { fireImmediately: true }
    )
  }

  private handleTap = () => {
    this.emitter.emit('ui:spinRequested', { bet: this.spinStore.bet })
  }

  private setEnabled(enabled: boolean) {
    this.eventMode = enabled ? 'static' : 'none'
    this.cursor = enabled ? 'pointer' : 'default'
    this.alpha = enabled ? 1 : 0.7
  }
}
