import { inject, injectable } from 'inversify'
import { Container, type DestroyOptions } from 'pixi.js'
import { TOKENS } from 'src/constants/tokens'
import type { GameEmitter } from 'src/events/game-emitter'
import type { GameEvents } from 'src/events/types'
import { ReelAnimation } from 'src/game/animations/reel-animation'
import type { GameTicker } from 'src/game/game-ticker'
import type { SpinResult } from 'src/types/game'

/**
 * Контроллер барабанов: создаёт анимацию, транслирует ей команды фаз
 * и подсвечивает результат по событию `spin:landed`.
 */
@injectable()
export class ReelsController extends Container {
  private readonly animation: ReelAnimation
  private readonly disposers: Array<() => void> = []

  constructor(@inject(TOKENS.GameTicker) ticker: GameTicker, @inject(TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>) {
    super()

    this.animation = new ReelAnimation(ticker)
    this.addChild(this.animation.view)

    this.disposers.push(emitter.on('spin:landed', (result) => this.animation.highlight(result)))
  }

  spin(signal?: AbortSignal): Promise<void> {
    return this.animation.spin(signal)
  }

  land(result: SpinResult, signal?: AbortSignal): Promise<void> {
    return this.animation.land(result, signal)
  }

  override destroy(options?: DestroyOptions): void {
    for (const dispose of this.disposers) {
      dispose()
    }

    this.disposers.length = 0

    super.destroy(options)
  }
}
