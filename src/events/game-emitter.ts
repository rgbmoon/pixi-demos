import { EventEmitter } from 'pixi.js'

import type { AnyHandler, EventMap, EventName, GameEvents } from './types'
import { traceEvent } from './utils'

/**
 * Типизированный эмиттер игровых событий: имена и payload'ы типизированы, эмит произвольной строки невозможен.
 *
 * Под капотом — EventEmitter из pixi.js (это eventemitter3, он уже в бандле как зависимость PIXI).
 * Обёртка добавляет к нему три недостающие вещи:
 *   1. on() отдаёт функцию отписки вместо `this` — не нужно хранить ссылку на колбэк ради off();
 *   2. ожидание события промисом (см. waitFor рядом);
 *   3. точку, куда вешается общий лог всех событий: wildcard-подписки у ee3 нет.
 */
export class GameEmitter<E extends EventMap> {
  private readonly emitter = new EventEmitter<Record<string, [unknown]>>()
  private readonly trace?: (event: string, payload: unknown) => void

  constructor(trace?: (event: string, payload: unknown) => void) {
    this.trace = trace
  }

  /**
   * Подписывает `handler` на событие `event`.
   * Возвращает функцию отписки — её обязан вызвать владелец подписки.
   */
  on<K extends EventName<E>>(event: K, handler: (payload: E[K]) => void): () => void {
    this.emitter.on(event, handler as AnyHandler)

    return () => {
      this.emitter.off(event, handler as AnyHandler)
    }
  }

  /** Доставляет `payload` всем, кто подписан на `event`, и отдаёт то же событие в трассировку. */
  emit<K extends EventName<E>>(event: K, payload: E[K]): void {
    this.trace?.(event, payload)

    this.emitter.emit(event, payload)
  }

  /**
   * Отдаёт число живых подписчиков по каждому событию — инструмент диагностики утечек.
   * Числа стабильны от раунда к раунду; рост означает, что кто-то не вызвал свою функцию отписки.
   */
  listenerCounts(): Record<string, number> {
    const counts: Record<string, number> = {}

    for (const event of this.emitter.eventNames()) {
      counts[event] = this.emitter.listenerCount(event)
    }

    return counts
  }
}

export const gameEmitter = new GameEmitter<GameEvents>(traceEvent)
