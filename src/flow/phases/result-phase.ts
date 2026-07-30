import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import type { GameEmitter } from 'src/events/game-emitter'
import type { GameEvents } from 'src/events/types'
import type { ReelsMachineController } from 'src/game/controllers/reels-machine'
import type { SceneStore } from 'src/stores/scene-store'
import { PhaseName } from 'src/types/game'

import type { Phase } from '../types'

/** Фаза показа результата: приземляет барабаны на серверные символы и объявляет `spin:landed`. */
@injectable()
export class ResultPhase implements Phase {
  readonly name = PhaseName.result

  private readonly emitter: GameEmitter<GameEvents>
  private readonly sceneStore: SceneStore
  private readonly reels: ReelsMachineController

  constructor(
    @inject(TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(TOKENS.SceneStore) sceneStore: SceneStore,
    @inject(TOKENS.ReelsMachineController) reels: ReelsMachineController
  ) {
    this.emitter = emitter
    this.sceneStore = sceneStore
    this.reels = reels
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.idle> {
    const result = this.sceneStore.spin.value

    if (!result) {
      return PhaseName.idle
    }

    this.emitter.emit('spin:landed', result)

    await this.reels.land(this.sceneStore.spinSymbols, signal)

    if (this.sceneStore.spinPaylines.length === 0) {
      return PhaseName.idle
    }

    await this.reels.showAllWins(signal)
    await this.reels.showTint(signal)
    await this.reels.playWinLines(signal)
    await this.reels.hideTint(signal)

    return PhaseName.idle
  }
}
