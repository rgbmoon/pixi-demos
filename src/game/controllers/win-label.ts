import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import { Label, LabelColor } from 'src/game/ui/label'
import { LiveContainer } from 'src/game/ui/live-container'
import { formatAmount } from 'src/game/utils'
import type { SpinStore } from 'src/stores/spin-store'

const FONT_SIZE = 24
const GAP = 8

/** Вывод значения выигрыша. */
@injectable()
export class WinLabel extends LiveContainer {
  private readonly caption = new Label({ color: LabelColor.gold, fontSize: FONT_SIZE, text: 'WIN' })
  private readonly value = new Label({ color: LabelColor.white, fontSize: FONT_SIZE })

  constructor(@inject(TOKENS.SpinStore) spinStore: SpinStore) {
    super()

    this.caption.anchor.set(1, 0.5)
    this.caption.position.set(-GAP / 2, 0)
    this.value.anchor.set(0, 0.5)
    this.value.position.set(GAP / 2, 0)

    this.addChild(this.caption, this.value)

    this.watch(
      () => spinStore.win,
      (win) => {
        this.value.text = formatAmount(win)
      },
      { fireImmediately: true }
    )
  }
}
