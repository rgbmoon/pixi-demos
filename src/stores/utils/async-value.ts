import { computed, flow, makeObservable, observable } from 'mobx'
import { RequestStatus } from 'src/types/network'

// TODO кажется можно упростить
/**
 * Асинхронное значение для стора: хранит результат, статус и ошибку запроса.
 * `run(task)` выполняет запрос и ведёт статусы; ошибку записывает в `error`, промис не реджектится.
 */
export class AsyncValue<T> {
  constructor() {
    // Применяет разметку legacy-декораторов к экземпляру (см. CLAUDE.md, «Стейт (MobX)»)
    makeObservable(this)
  }

  @observable.ref value: T | undefined = undefined
  @observable status: RequestStatus = RequestStatus.idle
  @observable.ref error: unknown = undefined

  @computed get isLoading(): boolean {
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
