import { injectable } from 'inversify'
import { action, computed, makeObservable, observable } from 'mobx'

import { INITIAL_PHASE } from '#src/constants'
import { type CellAddress, PhaseName } from '#src/types'

/**
 * Состояние игры
 */
@injectable()
export class ToyboxStore {
  constructor() {
    makeObservable(this)
  }

  /** Активная фаза. Единственный писатель — движок автомата через `setPhase`. */
  @observable phase: PhaseName = INITIAL_PHASE

  @computed get isIdle(): boolean {
    return this.phase === PhaseName.idle
  }

  /** Сколько игрушек попало в лоток за сессию. */
  @observable collected = 0

  /** Ячейка под клешнёй. Единственный писатель — контроллер клешни. */
  @observable.ref clawCell: CellAddress | undefined = undefined

  /** Доступно ли опускание клешни: цикл идёт целиком, прервать его нечем. */
  @computed get canDrop(): boolean {
    return this.isIdle
  }

  /**
   * Ячейка, которую игрок выбирает сейчас: по ней сцена подсвечивает игрушку.
   * Подсветка идёт только в покое, пока игрок ищет игрушку джойстиком.
   */
  @computed get targetCell(): CellAddress | undefined {
    return this.isIdle ? this.clawCell : undefined
  }

  @action setPhase(phase: PhaseName) {
    this.phase = phase
  }

  @action collect() {
    this.collected += 1
  }

  @action setClawCell(cell: CellAddress) {
    this.clawCell = cell
  }
}
