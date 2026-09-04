import { inject, injectable } from 'inversify'
import { LiveContainer } from 'src/engine/live-container'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { ValueLabel } from 'src/games/slot/ui/hud/value-label'
import { formatAmount } from 'src/games/slot/utils'

const CAPTION = 'CREDIT'

/** Строка над барабанами: ведёт значение за балансом игрока. */
@injectable()
export class CreditLabelController extends LiveContainer {
  private readonly valueLabel = new ValueLabel(CAPTION)

  constructor(@inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore) {
    super()

    this.addChild(this.valueLabel)

    this.watch(
      () => slotStore.credit,
      (credit) => this.valueLabel.setValue(formatAmount(credit)),
      { fireImmediately: true }
    )
  }
}
