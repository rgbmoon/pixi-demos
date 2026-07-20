import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import type { GameEmitter } from 'src/events/game-emitter'
import type { GameEvents } from 'src/events/types'
import type { SceneStore } from 'src/stores/scene-store'
import { PhaseName } from 'src/types/game'

import type { Phase } from '../types'

/** Фаза ожидания игрока: спит до события `ui:spinRequested`, записывает ставку в стор. */
@injectable()
export class IdlePhase implements Phase {
  readonly name = PhaseName.idle

  private readonly emitter: GameEmitter<GameEvents>
  private readonly sceneStore: SceneStore

  constructor(
    @inject(TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(TOKENS.SceneStore) sceneStore: SceneStore
  ) {
    this.emitter = emitter
    this.sceneStore = sceneStore
  }

  // Возвращаемый тип сужен до реальных целей фазы — граф переходов проверяет компилятор
  async enter(signal: AbortSignal): Promise<typeof PhaseName.spinning> {
    const { bet } = await this.emitter.waitFor('ui:spinRequested', { signal })

    this.sceneStore.setBet(bet)

    return PhaseName.spinning
  }
}
