import { inject, injectable } from 'inversify'
import type { RootApi } from 'src/api/root-api'
import { TOKENS } from 'src/constants/tokens'
import type { GameEmitter } from 'src/events/game-emitter'
import type { GameEvents } from 'src/events/types'
import type { ReelsMachineController } from 'src/game/controllers/reels-machine'
import type { SpinStore } from 'src/stores/spin-store'
import { PhaseName } from 'src/types/game'
import { RequestStatus } from 'src/types/network'

import type { Phase } from '../types'

/** Фаза вращения: параллельно шлёт запрос спина и крутит барабаны, исход выбирает по статусу ответа. */
@injectable()
export class SpinningPhase implements Phase {
  readonly name = PhaseName.spinning

  private readonly emitter: GameEmitter<GameEvents>
  private readonly spinStore: SpinStore
  private readonly api: RootApi
  private readonly reels: ReelsMachineController

  constructor(
    @inject(TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(TOKENS.SpinStore) spinStore: SpinStore,
    @inject(TOKENS.RootApi) api: RootApi,
    @inject(TOKENS.ReelsMachineController) reels: ReelsMachineController
  ) {
    this.emitter = emitter
    this.spinStore = spinStore
    this.api = api
    this.reels = reels
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.idle | typeof PhaseName.result> {
    const { bet, gameMode } = this.spinStore

    this.emitter.emit('spin:started', { bet })

    await Promise.all([
      this.spinStore.result.run(() => this.api.sendSpin(bet, gameMode, signal)),
      this.reels.spin(signal),
      this.reels.showTint(signal),
    ])

    if (this.spinStore.result.status === RequestStatus.error) {
      await this.reels.hideTint(signal)

      return PhaseName.idle
    }

    return PhaseName.result
  }
}
