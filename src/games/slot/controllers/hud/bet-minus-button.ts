import type { GameEmitter } from 'src/core/events/game-emitter'
import { LiveContainer } from 'src/engine/live-container'
import { BUTTON_ICONS } from 'src/games/slot/assets'
import type { GameEvents } from 'src/games/slot/events'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { ButtonSize, ButtonVariant, StepDirection } from 'src/games/slot/types'
import { Button } from 'src/games/slot/ui/hud/button'

/** Кнопка понижения ставки. */
export class BetMinusButtonController extends LiveContainer {
  private readonly button: Button

  constructor(slotStore: SlotStore, emitter: GameEmitter<GameEvents>) {
    super()

    this.button = new Button({
      variant: ButtonVariant.circle,
      size: ButtonSize.md,
      icon: BUTTON_ICONS.minus,
      label: 'Decrease bet',
      onTap: () => {
        slotStore.stepBet(StepDirection.backward)
        emitter.emit('ui:buttonTapped')
      },
    })

    this.addChild(this.button)

    this.watch(
      () => slotStore.canStepBet(StepDirection.backward),
      (canStep) => this.button.setEnabled(canStep),
      { fireImmediately: true }
    )
  }

  /** Сторона кнопки в дизайн-единицах: по ней панель расставляет ряд управления. */
  get sizeUnits(): number {
    return this.button.sizeUnits
  }
}
