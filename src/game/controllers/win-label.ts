import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import { Label, LabelColor } from 'src/game/ui/label'
import { LiveContainer } from 'src/game/ui/live-container'
import { formatAmount } from 'src/game/utils'
import type { FlowStore } from 'src/stores/flow-store'
import type { SceneStore } from 'src/stores/scene-store'
import { PhaseName } from 'src/types/game'

const FONT_SIZE = 48
const GAP = 16
const WIN_CAPTION = 'WIN'
const IDLE_MESSAGE = 'MAKE YOUR BET'
const SPIN_MESSAGE = 'GOOD LUCK'

/** Строка под барабанами: сумма выигрыша, а между раундами — подсказка по текущей фазе. */
@injectable()
export class WinLabel extends LiveContainer {
  private readonly sceneStore: SceneStore
  private readonly flowStore: FlowStore

  private readonly caption = new Label({ color: LabelColor.cyan, fontSize: FONT_SIZE })
  private readonly value = new Label({ color: LabelColor.white, fontSize: FONT_SIZE })

  constructor(@inject(TOKENS.SceneStore) sceneStore: SceneStore, @inject(TOKENS.FlowStore) flowStore: FlowStore) {
    super()

    this.sceneStore = sceneStore
    this.flowStore = flowStore

    this.caption.anchor.set(0, 0.5)
    this.value.anchor.set(0, 0.5)

    this.addChild(this.caption, this.value)

    // Две подписки за данными на один render: содержимое строки зависит и от суммы, и от фазы раунда
    this.watch(
      () => sceneStore.win,
      () => this.render(),
      { fireImmediately: true }
    )
    this.watch(
      () => flowStore.phase,
      () => this.render()
    )
  }

  private render(): void {
    const { win } = this.sceneStore

    this.caption.text = win > 0 ? WIN_CAPTION : ''
    this.value.text = win > 0 ? formatAmount(win) : this.message()

    this.layoutLabels()
  }

  private message(): string {
    return this.flowStore.phase === PhaseName.idle ? IDLE_MESSAGE : SPIN_MESSAGE
  }

  private layoutLabels(): void {
    const gap = this.caption.text ? GAP : 0
    const startX = -(this.caption.width + gap + this.value.width) / 2

    this.caption.position.set(startX, 0)
    this.value.position.set(startX + this.caption.width + gap, 0)
  }
}
