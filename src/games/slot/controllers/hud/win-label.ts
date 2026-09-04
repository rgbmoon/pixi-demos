import { inject, injectable } from 'inversify'
import { LiveContainer } from 'src/engine/live-container'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { PhaseName } from 'src/games/slot/types'
import { ValueLabel } from 'src/games/slot/ui/hud/value-label'
import { formatAmount } from 'src/games/slot/utils'

const WIN_CAPTION = 'WIN'
const IDLE_MESSAGE = 'MAKE YOUR BET'
const SPIN_MESSAGE = 'GOOD LUCK'

/** Строка под барабанами: сумма выигрыша, а между раундами — подсказка по текущей фазе. */
@injectable()
export class WinLabelController extends LiveContainer {
  private readonly slotStore: SlotStore
  private readonly valueLabel = new ValueLabel()

  constructor(@inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore) {
    super()

    this.slotStore = slotStore

    this.addChild(this.valueLabel)

    // Две подписки за данными на один render: содержимое строки зависит и от суммы, и от фазы раунда
    this.watch(
      () => slotStore.win,
      () => this.render(),
      { fireImmediately: true }
    )
    this.watch(
      () => slotStore.phase,
      () => this.render()
    )
  }

  private render(): void {
    const { win } = this.slotStore

    this.valueLabel.setText(win > 0 ? WIN_CAPTION : '', win > 0 ? formatAmount(win) : this.message())
  }

  private message(): string {
    return this.slotStore.phase === PhaseName.idle ? IDLE_MESSAGE : SPIN_MESSAGE
  }
}
