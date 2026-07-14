import { injectable } from 'inversify'
import { action, computed, makeObservable, observable } from 'mobx'
import { AsyncValue } from 'src/stores/utils/async-value'
import { PhaseName, type SpinResult } from 'src/types/game'

/** Состояние раунда: фаза автомата, ставка и результат спина. */
@injectable()
export class SpinStore {
  constructor() {
    makeObservable(this)
  }

  @observable phase: PhaseName = PhaseName.idle
  @observable bet = 10
  @observable.ref result = new AsyncValue<SpinResult>()
  @observable.ref fatalError: unknown = undefined

  @computed get canSpin(): boolean {
    return this.phase === PhaseName.idle
  }

  @action setPhase(phase: PhaseName) {
    this.phase = phase
  }

  @action setBet(bet: number) {
    this.bet = bet
  }

  @action setFatalError(error: unknown) {
    this.fatalError = error
  }
}
