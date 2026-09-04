/**
 * Фаза автомата: `enter` выполняется, пока фаза активна, и возвращает имя следующей фазы.
 * `signal` абортится при остановке автомата — его обязаны принимать все ожидания внутри фазы.
 * Параметр `TName` — набор имён фаз конкретной игры; движку хватает `string`.
 */
export type Phase<TName extends string = string> = {
  readonly name: TName
  enter(signal: AbortSignal): Promise<TName> | TName
  exit?(): void
}

/**
 * Куда движок публикует активную фазу: обычно это стор игры, который читают вью.
 * Пишет сюда только автомат — снаружи поле фазы меняться не должно.
 */
export type PhaseSink<TName extends string = string> = {
  setPhase(phase: TName): void
}

/**
 * Набор фаз игры глазами движка: с чего начинать петлю и какие имена обязаны быть забинжены в контейнере.
 * Значение живёт в композиции — движок имён конкретной игры не знает.
 */
export type FsmConfig = {
  initial: string
  names: readonly string[]
}
