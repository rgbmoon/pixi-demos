import { injectable } from 'inversify'
import { action, makeObservable, observable } from 'mobx'

import { INITIAL_PHASE } from '#src/constants'
import type { PhaseName } from '#src/types'

/** Состояние игры: пока только активная фаза автомата. */
@injectable()
export class ToyboxStore {
  constructor() {
    makeObservable(this)
  }

  /** Активная фаза. Единственный писатель — движок автомата через `setPhase`. */
  @observable phase: PhaseName = INITIAL_PHASE

  @action setPhase(phase: PhaseName) {
    this.phase = phase
  }
}
