import { inject, injectable } from 'inversify'
import { LiveContainer } from 'src/engine/live-container'
import { BUTTON_ICONS } from 'src/games/slot/assets'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { ButtonSize, ButtonVariant, StepDirection } from 'src/games/slot/types'
import { Button } from 'src/games/slot/ui/hud/button'

/** Кнопка шага вперёд по режимам игры. */
@injectable()
export class GameModePlusButtonController extends LiveContainer {
  private readonly button: Button

  constructor(@inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore) {
    super()

    this.button = new Button({
      variant: ButtonVariant.romb,
      size: ButtonSize.md,
      icon: BUTTON_ICONS.plus,
      onTap: () => slotStore.stepGameMode(StepDirection.forward),
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
