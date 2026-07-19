import { inject, injectable } from 'inversify'
import { action, computed, makeObservable, observable } from 'mobx'
import type { SpinResponse } from 'src/api/root-api'
import { TOKENS } from 'src/constants/tokens'
import type { FlowStore } from 'src/stores/flow-store'
import { AsyncValue } from 'src/stores/utils/async-value'
import { PhaseName } from 'src/types/game'

@injectable()
export class SpinStore {
  private readonly flowStore: FlowStore

  constructor(@inject(TOKENS.FlowStore) flowStore: FlowStore) {
    this.flowStore = flowStore

    makeObservable(this)
  }

  @observable bet = 10
  @observable gameMode = 4
  @observable credit = 999999
  @observable win = 0

  @observable.ref result = new AsyncValue<SpinResponse>()

  @computed get canSpin(): boolean {
    return this.flowStore.phase === PhaseName.idle
  }

  @action setBet(bet: number) {
    this.bet = bet
  }

  @action setGameMode(gameMode: number) {
    this.gameMode = gameMode
  }
}
