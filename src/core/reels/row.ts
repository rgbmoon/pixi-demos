import type { Cell } from './cell'
import type { ReelsMachine } from './reels-machine'

/** Поперечный ряд поля: по ячейке с каждого барабана. Им адресуются линии выплат. */
export class Row<TData, TValue> {
  readonly index: number
  readonly machine: ReelsMachine<TData, TValue>

  constructor(machine: ReelsMachine<TData, TValue>, index: number) {
    this.machine = machine
    this.index = index
  }

  /** Ячейки ряда слева направо; барабан короче ряда его пропускает. */
  getCells(): Cell<TData, TValue>[] {
    return this.machine.getReels().flatMap((reel) => {
      const cell = reel.getCell(this.index)

      return cell ? [cell] : []
    })
  }
}
