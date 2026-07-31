import { injectable } from 'inversify'
import { action, makeObservable, observable } from 'mobx'
import { INITIAL_PHASE } from 'src/flow/constants'
import type { PhaseName } from 'src/types/game'

/** Публичное состояние автомата. Единственный писатель — движок Fsm. */
@injectable()
export class FlowStore {
  constructor() {
    makeObservable(this)
  }

  @observable phase: PhaseName = INITIAL_PHASE

  @action setPhase(phase: PhaseName) {
    this.phase = phase
  }
}
