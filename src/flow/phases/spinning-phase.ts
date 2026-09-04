import { inject, injectable } from 'inversify'
import type { RootApi } from 'src/api/root-api'
import { TOKENS } from 'src/constants/tokens'
import { notifyError } from 'src/errors/utils'
import type { GameEmitter } from 'src/events/game-emitter'
import type { GameEvents } from 'src/events/types'
import type { ReelsMachineController } from 'src/game/controllers/reels-machine'
import type { SceneStore } from 'src/stores/scene-store'
import { PhaseName } from 'src/types/game'
import { RequestStatus } from 'src/types/network'

import type { Phase } from '../types'

/** Фаза вращения: параллельно шлёт запрос спина и крутит барабаны, исход выбирает по статусу ответа. */
@injectable()
export class SpinningPhase implements Phase {
  readonly name = PhaseName.spinning

  private readonly emitter: GameEmitter<GameEvents>
  private readonly sceneStore: SceneStore
  private readonly api: RootApi
  private readonly reels: ReelsMachineController

  constructor(
    @inject(TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(TOKENS.SceneStore) sceneStore: SceneStore,
    @inject(TOKENS.RootApi) api: RootApi,
    @inject(TOKENS.ReelsMachineController) reels: ReelsMachineController
  ) {
    this.emitter = emitter
    this.sceneStore = sceneStore
    this.api = api
    this.reels = reels
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.idle | typeof PhaseName.result> {
    const { bet, gameMode } = this.sceneStore

    this.emitter.emit('spin:started')

    this.sceneStore.setWin(0)
    this.sceneStore.chargeBet()
    this.reels.spin()

    await this.sceneStore.spin.run(this.api.sendSpin(bet, gameMode, signal))

    if (this.sceneStore.spin.status === RequestStatus.error) {
      this.sceneStore.refundBet()
      notifyError(this.sceneStore.spin.error, 'Spin failed, the bet has been refunded')

      return PhaseName.idle
    }

    return PhaseName.result
  }
}
