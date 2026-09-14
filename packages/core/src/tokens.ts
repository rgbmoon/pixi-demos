import type { ServiceIdentifier } from 'inversify'

import type { Fsm } from './fsm/fsm'
import type { FsmConfig, Phase, PhaseSink } from './fsm/types'

/**
 * Токены общих сущностей: движок автомата и приёмник активной фазы. Набор фаз конкретной игры приходит
 * значением `FsmConfig` из композиции — движок имён игры не знает.
 *
 * В рантайме файл обязан оставаться листом графа импортов: только `Symbol(...)`.
 */
export const CORE_TOKENS = {
  Fsm: Symbol('Fsm') as ServiceIdentifier<Fsm>,
  Phase: Symbol('Phase') as ServiceIdentifier<Phase>,
  FsmConfig: Symbol('FsmConfig') as ServiceIdentifier<FsmConfig>,
  PhaseSink: Symbol('PhaseSink') as ServiceIdentifier<PhaseSink>,
} as const
