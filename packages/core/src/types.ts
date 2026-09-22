import type { Container } from 'inversify'

/** Источник случайности: `Math.random` в проде, сидируемый генератор в моках и тестах. */
export type Random = () => number

/** Адрес значения в IndexedDB: база, стор внутри неё и ключ. */
export type IdbStorageOptions = {
  readonly dbName: string
  readonly storeName: string
  readonly key: string
}

/**
 * Контракт игрового модуля: единственное, что страница знает о самой игре.
 * `bind` наполняет её контейнер, `start` поднимает игру внутри элемента и резолвится,
 * когда играть уже можно; `signal` абортится при уходе со страницы.
 */
export type GameModule = {
  preload(): Promise<void>
  bind(container: Container): void
  start(container: Container, element: HTMLElement, signal: AbortSignal): Promise<void>
}

/** Изменение состояния физической клавиши. */
export type KeyboardChange = {
  readonly code: KeyboardEvent['code']
  readonly pressed: boolean
  readonly repeat: boolean
}

/** Настройки подписки на выбранные физические клавиши. */
export type KeyboardSubscriptionOptions = {
  /** Запрещает стандартное действие браузера только для клавиш этой подписки. */
  readonly preventDefault?: boolean
}

export type KeyboardListener = (change: KeyboardChange) => void

/** Внутренняя запись подписчика клавиатуры. */
export type KeyboardSubscription = {
  readonly codes: ReadonlySet<KeyboardEvent['code']>
  readonly listener: KeyboardListener
  readonly preventDefault: boolean
}
