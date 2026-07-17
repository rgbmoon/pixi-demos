import { injectable } from 'inversify'
import { action, makeObservable, observable } from 'mobx'
import { SceneTheme } from 'src/types/game'

@injectable()
export class SceneStore {
  constructor() {
    makeObservable(this)
  }

  @observable isSoundOn = true
  @observable theme: SceneTheme = SceneTheme.light

  @action toggleSound() {
    this.isSoundOn = !this.isSoundOn
  }

  @action toggleTheme() {
    this.theme = this.theme === SceneTheme.light ? SceneTheme.dark : SceneTheme.light
  }
}
