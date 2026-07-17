import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import type { GameEmitter } from 'src/events/game-emitter'
import type { GameEvents } from 'src/events/types'
import { ReelAnimation } from 'src/game/animations/reel-animation'
import type { GameTicker } from 'src/game/game-ticker'
import { LiveContainer } from 'src/game/ui/live-container'
import type { SpinResult } from 'src/types/game'

/**
 * Контроллер барабанов: создаёт анимацию, транслирует ей команды фаз
 * и подсвечивает результат по событию `spin:landed`.
 */
@injectable()
export class ReelsController extends LiveContainer {
  private readonly animation: ReelAnimation

  constructor(@inject(TOKENS.GameTicker) ticker: GameTicker, @inject(TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>) {
    super()

    this.animation = new ReelAnimation(ticker)
    this.addChild(this.animation.view)

    this.listen(emitter, 'spin:landed', (result) => this.animation.highlight(result))
  }

  layout(width: number, height: number): void {
    this.animation.resize(width, height)
  }

  spin(signal?: AbortSignal): Promise<void> {
    return this.animation.spin(signal)
  }

  land(result: SpinResult, signal?: AbortSignal): Promise<void> {
    return this.animation.land(result, signal)
  }
}
