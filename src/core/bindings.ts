import type { Container } from 'inversify'

import { Fsm } from './fsm/fsm'
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
