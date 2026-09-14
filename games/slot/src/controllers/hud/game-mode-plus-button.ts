import { BUTTON_ICONS } from '#src/assets'
import type { GameEvents } from '#src/events'
import type { SlotStore } from '#src/stores/slot'
import { ButtonSize, ButtonVariant, StepDirection } from '#src/types'
import { Button } from '#src/ui/hud/button'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import { LiveContainer } from '@pixi-demos/engine/live-container'

/** Кнопка шага вперёд по режимам игры. */
export class GameModePlusButtonController extends LiveContainer {
  private readonly button: Button

  constructor(slotStore: SlotStore, emitter: GameEmitter<GameEvents>) {
    super()

    this.button = new Button({
      variant: ButtonVariant.circle,
      size: ButtonSize.md,
      icon: BUTTON_ICONS.plus,
      label: 'More lines',
      onTap: () => {
        slotStore.stepGameMode(StepDirection.forward)
        emitter.emit('ui:buttonTapped')
      },
    })

    this.addChild(this.button)

    this.watch(
      () => slotStore.canStepGameMode(StepDirection.forward),
      (canStep) => this.button.setEnabled(canStep),
      { fireImmediately: true }
    )
  }

  /** Сторона кнопки в дизайн-единицах: по ней панель расставляет ряд управления. */
  get sizeUnits(): number {
    return this.button.sizeUnits
  }
}
