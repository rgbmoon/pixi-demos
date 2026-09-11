import { inject, injectable } from 'inversify'
import type { GameTicker } from 'src/engine/game-ticker'
import { LiveContainer } from 'src/engine/live-container'
import { ENGINE_TOKENS } from 'src/engine/tokens'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { PhaseName } from 'src/games/slot/types'
import { ValueLabel } from 'src/games/slot/ui/hud/value-label'
import { formatAmount } from 'src/games/slot/utils'

const CAPTION = 'CREDIT'

/** Строка над барабанами: ведёт значение за балансом игрока и трясётся на каждом его пополнении. */
@injectable()
export class CreditLabelController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly slotStore: SlotStore
  private readonly valueLabel = new ValueLabel(CAPTION)
  private credit: number
  private shakeAbort?: AbortController

  constructor(@inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker, @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore) {
    super()

    this.ticker = ticker
    this.slotStore = slotStore
    this.credit = slotStore.credit

    this.addChild(this.valueLabel)

    this.watch(
      () => slotStore.credit,
      (credit) => this.update(credit),
      { fireImmediately: true }
    )
  }

  override destroy(...args: Parameters<LiveContainer['destroy']>): void {
    this.shakeAbort?.abort()

    super.destroy(...args)
  }

  private update(credit: number): void {
    // Баланс, пришедший на загрузке, — не пополнение
    const isTopUp = credit > this.credit && this.slotStore.phase !== PhaseName.booting

    this.credit = credit
    this.valueLabel.setValue(formatAmount(credit))

    if (isTopUp) void this.shake()
  }

  /** Трясёт строку; новая тряска прерывает предыдущую, та возвращает строку на место. */
  private async shake(): Promise<void> {
    this.shakeAbort?.abort()

    const abort = new AbortController()

    this.shakeAbort = abort

    try {
      await this.valueLabel.shake(this.ticker, abort.signal)
    } catch {
      // Тряска прервана следующей: позицию уже вернул прерванный твин
    } finally {
      if (this.shakeAbort === abort) this.shakeAbort = undefined
    }
  }
}
