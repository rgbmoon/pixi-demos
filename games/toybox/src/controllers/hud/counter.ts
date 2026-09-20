import type { ToyboxStore } from '#src/stores/toybox'
import { Counter } from '#src/ui/hud/counter'
import { LiveContainer } from '@pixi-demos/engine/live-container'

/** Счётчик в углу экрана: ведёт значение за числом доставленных в лоток игрушек. */
export class CounterController extends LiveContainer {
  /** Высота строки в дизайн-единицах: по ней сцена отводит место под счётчик. */
  readonly heightUnits: number

  constructor(toyboxStore: ToyboxStore) {
    super()

    const counter = new Counter()

    this.heightUnits = counter.height

    this.addChild(counter)

    this.watch(
      () => toyboxStore.collected,
      (collected) => counter.setValue(collected),
      { fireImmediately: true }
    )
  }
}
