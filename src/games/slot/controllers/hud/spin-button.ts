import { inject, injectable } from 'inversify'
import type { GameEmitter } from 'src/core/events/game-emitter'
import { LiveContainer } from 'src/engine/live-container'
import { BUTTON_ICONS } from 'src/games/slot/assets'
import type { GameEvents } from 'src/games/slot/events'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { ButtonSize, ButtonVariant } from 'src/games/slot/types'
import { Button } from 'src/games/slot/ui/hud/button'

/**
 * Кнопка запуска спина: по тапу объявляет `ui:spinRequested`;
 * доступность следует за `slotStore.canSpin`.
 */
@injectable()
export class SpinButtonController extends LiveContainer {
  private readonly button: Button

  constructor(
    @inject(SLOT_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore
  ) {
    super()

    this.button = new Button({
      variant: ButtonVariant.circle,
      size: ButtonSize.lg,
      icon: BUTTON_ICONS.spin,
      iconRatio: 0.6,
      onTap: () => emitter.emit('ui:spinRequested'),
    })

    this.addChild(this.button)

    this.watch(
      () => slotStore.canSpin,
      (canSpin) => this.button.setEnabled(canSpin),
      { fireImmediately: true }
    )
  }

  /** Сторона кнопки в дизайн-единицах: по ней сцена расставляет ряд управления. */
  get sizeUnits(): number {
    return this.button.sizeUnits
  }
}
