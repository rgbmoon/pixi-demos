import { inject, injectable } from 'inversify'
import { action, computed, makeObservable, observable } from 'mobx'
import type { GameInitResponse, RootApi } from 'src/api/root-api'
import { TOKENS } from 'src/constants/tokens'

import { AsyncValue } from './utils/async-value'

@injectable()
export class SceneStore {
  constructor(@inject(TOKENS.RootApi) api: RootApi) {
    makeObservable(this)

    void this.game.run(() => api.initGame())
  }

  @observable isSoundOn = true
  @observable isAutospin = false
  @observable.ref game = new AsyncValue<GameInitResponse>()

  @computed get isGameLoading() {
    return this.game.isLoading
  }

  @action toggleSound() {
    this.isSoundOn = !this.isSoundOn
  }

  @action toggleAutospin() {
    this.isAutospin = !this.isAutospin
  }
}
