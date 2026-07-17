import { inject, injectable } from 'inversify'
import { BET_STEP } from 'src/constants/game'
import { TOKENS } from 'src/constants/tokens'
import { Button, ButtonSize, ButtonVariant } from 'src/game/ui/button'
import type { SpinStore } from 'src/stores/spin-store'

const BET_DOWN_ICON = '/src/assets/game/graphic/Icons/minus-svgrepo-com.svg'

/**
 * Кнопка понижения ставки
 */
@injectable()
export class BetMinusButton extends Button {
  private readonly spinStore: SpinStore

  constructor(@inject(TOKENS.SpinStore) spinStore: SpinStore) {
    super({
      variant: ButtonVariant.circle,
      size: ButtonSize.md,
      icon: BET_DOWN_ICON,
    })

    this.spinStore = spinStore

    this.on('pointertap', this.handleTap)
  }

  private handleTap = () => {
    this.spinStore.setBet(this.spinStore.bet - BET_STEP)
  }
}
