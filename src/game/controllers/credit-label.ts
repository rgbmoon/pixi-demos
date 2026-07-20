import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import { Label, LabelColor } from 'src/game/ui/label'
import { LiveContainer } from 'src/game/ui/live-container'
import { formatAmount } from 'src/game/utils'
import type { SceneStore } from 'src/stores/scene-store'

const CAPTION_SIZE = 16
const VALUE_SIZE = 20
const LINE_GAP = 4

/** Вывод значения баланса */
@injectable()
export class CreditLabel extends LiveContainer {
  private readonly caption = new Label({ color: LabelColor.gold, fontSize: CAPTION_SIZE, text: 'CREDIT' })
  private readonly value = new Label({ color: LabelColor.white, fontSize: VALUE_SIZE })

  constructor(@inject(TOKENS.SceneStore) sceneStore: SceneStore) {
    super()

    this.caption.anchor.set(0.5, 1)
    this.caption.position.set(0, -LINE_GAP / 2)
    this.value.anchor.set(0.5, 0)
    this.value.position.set(0, LINE_GAP / 2)

    this.addChild(this.caption, this.value)

    this.watch(
      () => sceneStore.credit,
      (credit) => {
        this.value.text = formatAmount(credit)
      },
      { fireImmediately: true }
    )
  }
}
