import { injectable } from 'inversify'
import { action, computed, makeObservable, observable } from 'mobx'

import { INITIAL_PHASE } from '#src/constants'
import { PhaseName } from '#src/types'

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

  /** Доступно ли опускание клешни: цикл идёт целиком, прервать его нечем. */
  @computed get canDrop(): boolean {
    return this.isIdle
  }

  @action setPhase(phase: PhaseName) {
    this.phase = phase
  }
}
