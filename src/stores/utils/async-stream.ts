import { action, makeObservable, observable, runInAction } from 'mobx'

/**
 * Push-подписка для стора: `start(subscribe)` подписывается и складывает входящие
 * значения в `value`, `stop()` отписывается.
 */
export class AsyncStream<T> {
  constructor() {
    makeObservable(this)
  }

  @observable.ref value: T | undefined = undefined

  private dispose: (() => void) | null = null

  @action start(subscribe: (onValue: (value: T) => void) => () => void): void {
    this.stop()
    this.dispose = subscribe((value) => {
      runInAction(() => {
        this.value = value
      })
    })
  }

  @action stop(): void {
    this.dispose?.()
    this.dispose = null
  }
}
