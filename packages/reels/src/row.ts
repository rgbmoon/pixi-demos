import type { Cell } from './cell'
import type { ReelsMachine } from './reels-machine'

/** Поперечный ряд поля: по ячейке с каждого барабана. */
export class Row<TValue> {
  readonly index: number
  readonly machine: ReelsMachine<TValue>

  constructor(machine: ReelsMachine<TValue>, index: number) {
    this.machine = machine
    this.index = index
  }

  /** Ячейки ряда слева направо; барабан короче ряда его пропускает. */
  getCells(): Cell<TValue>[] {
    return this.machine.getReels().flatMap((reel) => {
      const cell = reel.getCell(this.index)

      return cell ? [cell] : []
    })
  }
}
