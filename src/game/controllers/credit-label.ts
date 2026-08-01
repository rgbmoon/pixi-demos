import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import { Label, LabelColor } from 'src/game/ui/label'
import { LiveContainer } from 'src/game/ui/live-container'
import { formatAmount } from 'src/game/utils'
import type { SceneStore } from 'src/stores/scene-store'

const FONT_SIZE = 24
const GAP = 8
const CAPTION = 'CREDIT'

/** Строка над барабанами: подпись и баланс в одну строку, выровнены по центру. */
@injectable()
export class CreditLabel extends LiveContainer {
  private readonly caption = new Label({ color: LabelColor.gold, fontSize: FONT_SIZE, text: CAPTION })
  private readonly value = new Label({ color: LabelColor.white, fontSize: FONT_SIZE })

  constructor(@inject(TOKENS.SceneStore) sceneStore: SceneStore) {
    super()

    this.caption.anchor.set(0, 0.5)
    this.value.anchor.set(0, 0.5)

    this.addChild(this.caption, this.value)

    this.watch(
      () => sceneStore.credit,
      (credit) => {
        this.value.text = formatAmount(credit)

        this.layoutLabels()
      },
      { fireImmediately: true }
    )
  }

  /** Собирает строку из подписи и суммы и центрирует её по origin. */
  private layoutLabels(): void {
    const startX = -(this.caption.width + GAP + this.value.width) / 2

    this.caption.position.set(startX, 0)
    this.value.position.set(startX + this.caption.width + GAP, 0)
  }
}
