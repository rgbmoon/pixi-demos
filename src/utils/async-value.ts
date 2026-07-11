import { flow, makeAutoObservable } from 'mobx'
import { RequestStatus } from 'src/types/network'

export class AsyncValue<T> {
  value: T | undefined = undefined
  status: RequestStatus = RequestStatus.idle
  error: unknown = undefined

  constructor() {
    makeAutoObservable(this)
  }

  get isLoading(): boolean {
    return this.status === RequestStatus.loading
  }

  run = flow(function* (this: AsyncValue<T>, task: () => Promise<T>) {
    this.status = RequestStatus.loading
    this.error = undefined

    try {
      this.value = yield task()
      this.status = RequestStatus.success
    } catch (error) {
      this.error = error
      this.status = RequestStatus.error
    }
  })
}
