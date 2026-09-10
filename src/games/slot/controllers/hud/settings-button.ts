import { inject, injectable } from 'inversify'
import { LiveContainer } from 'src/engine/live-container'
import { BUTTON_ICONS } from 'src/games/slot/assets'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { ButtonSize, ButtonVariant } from 'src/games/slot/types'
import { Button } from 'src/games/slot/ui/hud/button'

/** Кнопка открытия настроек; при открытой модалке недоступна. */
@injectable()
export class SettingsButtonController extends LiveContainer {
  private readonly button: Button

  constructor(@inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore) {
    super()

    this.button = new Button({
      variant: ButtonVariant.romb,
      size: ButtonSize.md,
      icon: BUTTON_ICONS.settings,
      label: 'Settings',
      onTap: () => slotStore.openSettings(),
    })

    this.addChild(this.button)

    this.watch(
      () => slotStore.isSettingsOpen,
      (isOpen) => this.button.setEnabled(!isOpen),
      { fireImmediately: true }
    )
  }

  /** Сторона кнопки в дизайн-единицах: по ней сцена расставляет верхний ряд. */
  get sizeUnits(): number {
    return this.button.sizeUnits
  }
}
