import type { Reel } from './reel'
import type { ReelsMachine } from './reels-machine'
import type { CellContext, CellIndex, StripSlot } from './types'

/**
 * Ячейка поля: стабильный адрес `(барабан, ряд)`, по которому линии и оверлеи находят значение.
 * `getValue` читает данные раунда, `getSlot` — то, что стоит в ячейке на экране: во время вращения
 * они расходятся, после посадки совпадают.
 */
export class Cell<TData, TValue> {
  readonly id: string
  readonly index: CellIndex
  readonly reel: Reel<TData, TValue>
  readonly machine: ReelsMachine<TData, TValue>

  constructor(reel: Reel<TData, TValue>, row: number) {
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
  getSlot(): StripSlot<TValue> | undefined {
    return this.reel.getSlotAt(this.index.row)
  }

  getContext(): CellContext<TData, TValue> {
    return {
      machine: this.machine,
      reel: this.reel,
      cell: this,
      getValue: () => this.getValue(),
    }
  }
}
