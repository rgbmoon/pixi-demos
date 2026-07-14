import { action, computed, makeObservable, observable } from 'mobx'
import { AsyncValue } from 'src/stores/utils/async-value'
import { PhaseName, type SpinResult } from 'src/types/game'

class SpinStore {
  phase: PhaseName = PhaseName.idle
  bet = 10
  result = new AsyncValue<SpinResult>()
  fatalError: unknown = undefined

  constructor() {
    makeObservable(this, {
      phase: observable,
      bet: observable,
      result: observable.ref,
      fatalError: observable.ref,
      canSpin: computed,
      setPhase: action,
      setBet: action,
      setFatalError: action,
    })
  }

  get canSpin(): boolean {
    return this.phase === PhaseName.idle
  }

  setPhase(phase: PhaseName) {
    this.phase = phase
  }

  setBet(bet: number) {
    this.bet = bet
  }

  setFatalError(error: unknown) {
    this.fatalError = error
  }
}

export const spinStore = new SpinStore()
