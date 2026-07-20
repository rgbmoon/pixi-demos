import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import type { GameEmitter } from 'src/events/game-emitter'
import type { GameEvents } from 'src/events/types'
import type { ReelsMachineController } from 'src/game/controllers/reels-machine'
import type { SpinStore } from 'src/stores/spin-store'
import { PhaseName } from 'src/types/game'

import type { Phase } from '../types'

/** Фаза показа результата: приземляет барабаны на серверные символы и объявляет `spin:landed`. */
@injectable()
export class ResultPhase implements Phase {
  readonly name = PhaseName.result

  private readonly emitter: GameEmitter<GameEvents>
  private readonly spinStore: SpinStore
  private readonly reels: ReelsMachineController

  constructor(
    @inject(TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(TOKENS.SpinStore) spinStore: SpinStore,
    @inject(TOKENS.ReelsMachineController) reels: ReelsMachineController
  ) {
    this.emitter = emitter
    this.spinStore = spinStore
    this.reels = reels
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.idle> {
    const result = this.spinStore.result.value

    if (!result) {
      return PhaseName.idle
    }

    await Promise.all([this.reels.land(result, signal), this.reels.hideTint(signal)])

    this.emitter.emit('spin:landed', result)

    return PhaseName.idle
  }
}
