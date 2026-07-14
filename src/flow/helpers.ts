import { PhaseName } from 'src/types/game'

import { Fsm } from './fsm'
import { idlePhase } from './phases/idle'
import { resultPhase } from './phases/result'
import { spinningPhase } from './phases/spinning'
import type { CreateGameFsmOptions } from './types'

/**
 * Собирает автомат раунда: подставляет в движок фазы игры.
 */
export const createGameFsm = ({ context, onPhaseChange, onError }: CreateGameFsmOptions): Fsm =>
  new Fsm({
    phases: {
      [PhaseName.idle]: idlePhase,
      [PhaseName.spinning]: spinningPhase,
      [PhaseName.result]: resultPhase,
    },
    initial: PhaseName.idle,
    context,
    onPhaseChange,
    onError,
  })
