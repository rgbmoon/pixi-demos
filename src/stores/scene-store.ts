import { injectable } from 'inversify'
import { action, makeObservable, observable } from 'mobx'

@injectable()
export class SceneStore {
  constructor() {
    makeObservable(this)
  }

  @observable isSoundOn = true
  @observable isAutospin = false

  @action toggleSound() {
    this.isSoundOn = !this.isSoundOn
  }

  @action toggleAutospin() {
    this.isAutospin = !this.isAutospin
  }
}
