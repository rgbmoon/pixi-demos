import { Container, type DestroyOptions, type Ticker } from 'pixi.js'
import type { GameEmitter } from 'src/events/game-emitter'
import type { GameEvents } from 'src/events/types'
import { ReelAnimation } from 'src/game/animations/reel-animation'
import type { SpinResult } from 'src/types/game'

export class ReelsController extends Container {
  private readonly animation: ReelAnimation
  private readonly disposers: Array<() => void> = []

  constructor(ticker: Ticker, emitter: GameEmitter<GameEvents>) {
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

  layout(screenWidth: number, screenHeight: number): void {
    this.position.set((screenWidth - this.animation.width) / 2, screenHeight / 2 - this.animation.height)
  }

  override destroy(options?: DestroyOptions): void {
    for (const dispose of this.disposers) {
      dispose()
    }

    this.disposers.length = 0

    super.destroy(options)
  }
}
