import { makeAutoObservable, runInAction } from 'mobx'

export class AsyncStream<T> {
  value: T | undefined = undefined

  private dispose: (() => void) | null = null

  constructor() {
    makeAutoObservable<this, 'dispose'>(this, { dispose: false })
  }

  start(subscribe: (onValue: (value: T) => void) => () => void): void {
    this.stop()
    this.dispose = subscribe((value) => {
      runInAction(() => {
        this.value = value
      })
    })
  }

  stop(): void {
    this.dispose?.()
    this.dispose = null
  }
}
