import type { PhaseName } from 'src/types/game'

/**
 * Фаза автомата: `enter` выполняется, пока фаза активна, и возвращает имя следующей фазы.
 * `signal` абортится при остановке автомата — его обязаны принимать все ожидания внутри фазы.
 */
export type Phase = {
  readonly name: PhaseName
  enter(signal: AbortSignal): Promise<PhaseName> | PhaseName
  exit?(): void
}
