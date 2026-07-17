import { type IReactionOptions, reaction } from 'mobx'
import { Container, type DestroyOptions } from 'pixi.js'
import type { GameEmitter } from 'src/events/game-emitter'
import type { EventMap, EventName } from 'src/events/types'

/**
 * База view-классов с внешними подписками: watch/listen сами регистрируют
 * функцию отписки, destroy снимает все подписки разом.
 */
export class LiveContainer extends Container {
  private readonly disposers: Array<() => void> = []

  /** Реакция на MobX-выражение; отписка привязана к destroy. */
  protected watch<T>(
    expression: () => T,
    effect: (value: T) => void,
    options?: IReactionOptions<T, boolean>
  ): void {
    if (this.destroyed) return

    this.disposers.push(reaction(expression, effect, options))
  }

  /** Подписка на событие эмиттера; отписка привязана к destroy. */
  protected listen<E extends EventMap, K extends EventName<E>>(
    emitter: GameEmitter<E>,
    event: K,
    handler: (payload: E[K]) => void
  ): void {
    if (this.destroyed) return

    this.disposers.push(emitter.on(event, handler))
  }

  override destroy(options?: DestroyOptions): void {
    for (const dispose of this.disposers) {
      dispose()
    }

    this.disposers.length = 0

    super.destroy(options)
  }
}
