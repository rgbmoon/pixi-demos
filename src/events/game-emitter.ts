import { EventEmitter } from 'pixi.js'

import type { EventMap, EventName, GameEvents } from './types'

type AnyHandler = (payload: unknown) => void

/**
 * Типизированный эмиттер — центр регистрации имён событий игры.
 *
 * Под капотом EventEmitter из pixi.js (это eventemitter3, он уже в бандле как зависимость PIXI.
 * Обёртка нужна, потому что у голого ee3 не хватает трёх вещей:
 *   1. on() возвращает `this`, а не функцию отписки — приходится хранить ссылку на колбэк;
 *   2. нет промиса ожидания события (см. waitFor рядом);
 *   3. нет wildcard-подписки, а значит негде повесить общий лог всех эвентов.
 *
 * Внутренний эмиттер сознательно типизирован «широко» (payload как unknown): протащить в его
 * дженерики нашу карту не выйдет — TS не сводит `keyof E` к его собственным mapped-типам.
 * Поэтому всю типобезопасность держат сигнатуры методов ниже, а два каста handler'а
 * заперты внутри этого класса и наружу не текут.
 *
 * Прямой доступ к внутреннему эмиттеру закрыт намеренно: off(event) без колбэка и
 * removeAllListeners() снимают ЧУЖИЕ подписки, и такой вызов из компонента ломает соседей.
 */
export class GameEmitter<E extends EventMap> {
  private readonly emitter = new EventEmitter<Record<string, [unknown]>>()

  private readonly trace?: (event: string, payload: unknown) => void

  constructor(trace?: (event: string, payload: unknown) => void) {
    this.trace = trace
  }

  on<K extends EventName<E>>(event: K, handler: (payload: E[K]) => void): () => void {
    this.emitter.on(event, handler as AnyHandler)

    return () => {
      this.emitter.off(event, handler as AnyHandler)
    }
  }

  emit<K extends EventName<E>>(event: K, payload: E[K]): void {
    this.trace?.(event, payload)

    this.emitter.emit(event, payload)
  }

  /**
   * Диагностика утечек.
   * Числа должны быть стабильны от раунда к раунду — монотонный рост означает,
   * что кто-то не вызвал свою функцию отписки.
   */
  listenerCounts(): Record<string, number> {
    const counts: Record<string, number> = {}

    for (const event of this.emitter.eventNames()) {
      counts[event] = this.emitter.listenerCount(event)
    }

    return counts
  }
}

// Трассировка всех событий в одной точке — главный инструмент отладки эвентной архитектуры:
// по консоли видно точную последовательность моментов раунда. Собирается только в DEV.
const traceEvent = import.meta.env.DEV
  ? (event: string, payload: unknown) => {
      // eslint-disable-next-line no-console
      console.debug(`%c[event] ${event}`, 'color: #a98fc3', payload)
    }
  : undefined

export const gameEmitter = new GameEmitter<GameEvents>(traceEvent)
