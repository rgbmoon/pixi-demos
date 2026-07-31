import { type IReactionOptions, reaction } from 'mobx'
import { Container, type DestroyOptions } from 'pixi.js'
import { notifyError } from 'src/errors/utils'
import type { GameEmitter } from 'src/events/game-emitter'
import type { EventMap, EventName } from 'src/events/types'

/**
 * База view-классов с внешними подписками: watch/listen сами регистрируют
 * функцию отписки, destroy снимает все подписки разом.
 */
export class LiveContainer extends Container {
  private readonly disposers: Array<() => void> = []

  /**
   * Прогоняет обработчик подписки: его исключение не должно ни теряться в MobX,
   * который глушит ошибки реакций, ни ронять фазу, эмитившую событие.
   */
  private guard(run: () => void): void {
    try {
      run()
    } catch (error) {
      notifyError(error)
    }
  }

  /** Реакция на MobX-выражение; отписка привязана к destroy. */
  protected watch<T>(expression: () => T, effect: (value: T) => void, options?: IReactionOptions<T, boolean>): void {
    if (this.destroyed) return

    this.disposers.push(
      reaction(
        expression,
        (value) => {
          this.guard(() => effect(value))
        },
        options
      )
    )
  }

  /** Подписка на событие эмиттера; отписка привязана к destroy. */
  protected listen<E extends EventMap, K extends EventName<E>>(
    emitter: GameEmitter<E>,
    event: K,
    handler: (payload: E[K]) => void
  ): void {
    if (this.destroyed) return

    this.disposers.push(
      emitter.on(event, (payload) => {
        this.guard(() => handler(payload))
      })
    )
  }

  override destroy(options?: DestroyOptions): void {
    for (const dispose of this.disposers) {
      dispose()
    }

    this.disposers.length = 0

    super.destroy(options)
  }
}
