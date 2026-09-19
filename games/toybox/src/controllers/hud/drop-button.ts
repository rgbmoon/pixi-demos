import type { GameEvents } from '#src/events'
import type { ToyboxStore } from '#src/stores/toybox'
import { DropButton } from '#src/ui/hud/drop-button'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import { LiveContainer } from '@pixi-demos/engine/live-container'

/** Кнопка опускания клешни: объявляет намерение игрока, цикл ведёт автомат. */
export class DropButtonController extends LiveContainer {
  private readonly button: DropButton

  constructor(toyboxStore: ToyboxStore, emitter: GameEmitter<GameEvents>) {
    super()

    this.button = new DropButton({
      label: 'Drop the claw',
      onTap: () => emitter.emit('ui:dropRequested'),
    })

    this.addChild(this.button)

    this.watch(
      () => toyboxStore.canDrop,
      (enabled) => this.button.setEnabled(enabled),
      { fireImmediately: true }
    )
  }

  /** Сторона кнопки в дизайн-единицах: по ней сцена считает габариты блока управления. */
  get sizeUnits(): number {
    return this.button.sizeUnits
  }
}
