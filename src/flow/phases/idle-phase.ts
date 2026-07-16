import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import type { GameEmitter } from 'src/events/game-emitter'
import type { GameEvents } from 'src/events/types'
import type { SpinStore } from 'src/stores/spin-store'
import { PhaseName } from 'src/types/game'

import type { Phase } from '../types'

/** Фаза ожидания игрока: спит до события `ui:spinRequested`, записывает ставку в стор. */
@injectable()
export class IdlePhase implements Phase {
  readonly name = PhaseName.idle

  private readonly emitter: GameEmitter<GameEvents>
  private readonly spinStore: SpinStore

  constructor(
    @inject(TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(TOKENS.SpinStore) spinStore: SpinStore
  ) {
    this.emitter = emitter
    this.spinStore = spinStore
  }

  // Возвращаемый тип сужен до реальных целей фазы — граф переходов проверяет компилятор
  async enter(signal: AbortSignal): Promise<typeof PhaseName.spinning> {
    const { bet } = await this.emitter.waitFor('ui:spinRequested', { signal })

    this.spinStore.setBet(bet)

    return PhaseName.spinning
  }
}
