import type { Container } from 'inversify'

import { Fsm } from './fsm/fsm'
import { KeyboardInput } from './keyboard-input'
import { CORE_TOKENS } from './tokens'

/**
 * Движок автомата. Набор фаз и приёмник активной фазы приносит игра — движок общий,
 * а его содержимое нет.
 */
export const bindFsm = (container: Container): void => {
  container
    .bind(CORE_TOKENS.Fsm)
    .to(Fsm)
    .onDeactivation((fsm) => fsm.dispose())
}

/** Один источник клавиатуры на игровой контейнер. */
export const bindKeyboardInput = (container: Container): void => {
  container
    .bind(CORE_TOKENS.KeyboardInput)
    .toDynamicValue(() => new KeyboardInput(window))
    .onDeactivation((keyboard) => keyboard.dispose())
}
