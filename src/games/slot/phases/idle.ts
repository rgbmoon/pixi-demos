import { inject, injectable } from 'inversify'
import type { GameEmitter } from 'src/core/events/game-emitter'
import type { Phase } from 'src/core/fsm/types'
import type { GameEvents } from 'src/games/slot/events'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { PhaseName } from 'src/games/slot/types'

/** Фаза ожидания игрока: спит до события `ui:spinRequested`. */
@injectable()
export class IdlePhase implements Phase<PhaseName> {
  readonly name = PhaseName.idle

  private readonly emitter: GameEmitter<GameEvents>

  constructor(@inject(SLOT_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>) {
    this.emitter = emitter
  }

  // Возвращаемый тип сужен до реальных целей фазы — граф переходов проверяет компилятор
  async enter(signal: AbortSignal): Promise<typeof PhaseName.spinning> {
    await this.emitter.waitFor('ui:spinRequested', { signal })

    return PhaseName.spinning
  }
}
