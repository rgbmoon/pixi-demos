import { inject, injectable } from 'inversify'

import type { GameEvents } from '#src/events'
import { TOYBOX_TOKENS } from '#src/tokens'
import { PhaseName } from '#src/types'
import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { Phase } from '@pixi-demos/core/fsm/types'

/**
 * Стартовая фаза: данных для загрузки у игры нет, поэтому фаза объявляет игру готовой
 * и переводит автомат в покой.
 */
@injectable()
export class BootingPhase implements Phase<PhaseName> {
  readonly name = PhaseName.booting

  private readonly emitter: GameEmitter<GameEvents>

  constructor(@inject(TOYBOX_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>) {
    this.emitter = emitter
  }

  enter(): typeof PhaseName.idle {
    this.emitter.emit('game:booted')

    return PhaseName.idle
  }
}
