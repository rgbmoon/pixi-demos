import { makeAutoObservable } from 'mobx'
import { PhaseName, type SpinResult } from 'src/types/game'
import { AsyncValue } from 'src/utils/async-value'

class SpinStore {
  phase: PhaseName = PhaseName.idle
  bet = 10
  result = new AsyncValue<SpinResult>()
  fatalError: unknown = undefined

  constructor() {
    makeAutoObservable(this)
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
