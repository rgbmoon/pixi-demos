import type { Container } from 'inversify'

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
