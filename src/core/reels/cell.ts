import type { Reel } from './reel'
import type { ReelsMachine } from './reels-machine'
import type { CellIndex, StripSlot } from './types'

/**
 * Ячейка поля: постоянный адрес `(барабан, ряд)`. `getValue` возвращает значение из данных раунда,
 * `getSlot` — слот, который стоит в ячейке сейчас; после посадки они совпадают.
 */
export class Cell<TValue> {
  readonly id: string
  readonly index: CellIndex
  readonly reel: Reel<TValue>
  readonly machine: ReelsMachine<TValue>

  constructor(reel: Reel<TValue>, row: number) {
    this.reel = reel
    this.machine = reel.machine
    this.index = { reel: reel.index, row }
    this.id = `${reel.id}_${row}`
  }

  /** Значение ячейки в данных раунда; `undefined` — результата на неё нет. */
  getValue(): TValue | undefined {
    return this.reel.readValue(this.index.row)
  }

  /** Слот ленты, занимающий ячейку сейчас. */
  getSlot(): Readonly<StripSlot<TValue>> | undefined {
    return this.reel.getSlotAt(this.index.row)
  }
}
