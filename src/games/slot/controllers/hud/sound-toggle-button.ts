import { inject, injectable } from 'inversify'
import type { GameEmitter } from 'src/core/events/game-emitter'
import { LiveContainer } from 'src/engine/live-container'
import { BUTTON_ICONS } from 'src/games/slot/assets'
import type { GameEvents } from 'src/games/slot/events'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { ButtonSize, ButtonVariant } from 'src/games/slot/types'
import { Button } from 'src/games/slot/ui/hud/button'

/** Кнопка отключения и включения звука: нажатая подложка означает выключенный звук. */
@injectable()
export class SoundToggleButtonController extends LiveContainer {
  private readonly button: Button

  constructor(
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore,
    @inject(SLOT_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>
  ) {
    super()

    this.button = new Button({
      variant: ButtonVariant.romb,
      size: ButtonSize.md,
      icon: BUTTON_ICONS.soundOn,
      label: 'Toggle sound',
      onTap: () => {
        slotStore.toggleSound()
        emitter.emit('ui:buttonTapped')
      },
    })

    this.addChild(this.button)

    this.watch(
      () => slotStore.isSoundOn,
      (on) => {
        this.button.active = !on
        this.button.setIcon(on ? BUTTON_ICONS.soundOn : BUTTON_ICONS.soundOff)
      },
      { fireImmediately: true }
    )
  }

  /** Сторона кнопки в дизайн-единицах: по ней сцена расставляет ряд управления. */
  get sizeUnits(): number {
    return this.button.sizeUnits
  }
}
