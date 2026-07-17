import { injectable } from 'inversify'
import { action, makeObservable, observable } from 'mobx'

@injectable()
export class SceneStore {
  constructor() {
    makeObservable(this)
  }

  @observable isSoundOn = true

  @action toggleSound() {
    this.isSoundOn = !this.isSoundOn
  }
}
