import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import type { GameEmitter } from 'src/events/game-emitter'
import type { GameEvents } from 'src/events/types'
import type { ReelsMachineController } from 'src/game/controllers/reels-machine'
import type { GameTicker } from 'src/game/game-ticker'
import type { SceneStore } from 'src/stores/scene-store'
import { PhaseName } from 'src/types/game'

import { WIN_DISPLAY_MS } from '../constants'
import type { Phase } from '../types'

/** Фаза показа результата: приземляет барабаны на серверные символы и объявляет `spin:landed`. */
@injectable()
export class ResultPhase implements Phase {
  readonly name = PhaseName.result

  private readonly emitter: GameEmitter<GameEvents>
  private readonly sceneStore: SceneStore
  private readonly reels: ReelsMachineController
  private readonly ticker: GameTicker

  constructor(
    @inject(TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(TOKENS.SceneStore) sceneStore: SceneStore,
    @inject(TOKENS.ReelsMachineController) reels: ReelsMachineController,
    @inject(TOKENS.GameTicker) ticker: GameTicker
  ) {
    this.emitter = emitter
    this.sceneStore = sceneStore
    this.reels = reels
    this.ticker = ticker
  }

  async enter(signal: AbortSignal): Promise<typeof PhaseName.idle> {
    const result = this.sceneStore.spin.value

    if (!result) {
      return PhaseName.idle
    }

    await this.reels.land(this.sceneStore.spinSymbols, signal)

    // Событие в прошедшем времени эмитится после посадки: подписчик (звук, аналитика) видит реально остановленные барабаны
    this.emitter.emit('spin:landed', result)

    // Сумма встаёт в WinLabel до анимаций линий и висит там, пока раунд не закроется
    this.sceneStore.setWin(this.sceneStore.spinWin)

    if (this.sceneStore.spinPaylines.length > 0) {
      await this.reels.showAllWins(signal)
      await this.reels.showTint(signal)
      await this.reels.playWinLines(signal)
      await this.reels.hideTint(signal)
      await this.ticker.waitTicks(WIN_DISPLAY_MS, signal)
    }

    this.sceneStore.settleRound(result.response.result.balance)

    return PhaseName.idle
  }
}
