import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import type { GameEmitter } from 'src/events/game-emitter'
import type { GameEvents } from 'src/events/types'
import { PhaseName } from 'src/types/game'

import type { Phase } from '../types'

/** Фаза ожидания игрока: спит до события `ui:spinRequested`. */
@injectable()
export class IdlePhase implements Phase {
  readonly name = PhaseName.idle

  private readonly emitter: GameEmitter<GameEvents>

  constructor(@inject(TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>) {
    this.emitter = emitter
  }

  // Возвращаемый тип сужен до реальных целей фазы — граф переходов проверяет компилятор
  async enter(signal: AbortSignal): Promise<typeof PhaseName.spinning> {
    await this.emitter.waitFor('ui:spinRequested', { signal })

    return PhaseName.spinning
  }
}
