import { inject, injectable } from 'inversify'
import type { SpinResponse } from 'src/api/root-api'
import { TOKENS } from 'src/constants/tokens'
import { ReelsFrameAnimation } from 'src/game/animations/reels-frame-animation'
import type { GameTicker } from 'src/game/game-ticker'
import { LiveContainer } from 'src/game/ui/live-container'

// паузы-заглушки: держат темп раунда, пока нет настоящих барабанов
const SPIN_DURATION_MS = 900
const LAND_DURATION_MS = 350

/**
 * Контроллер зоны барабанов: Spine-рамка с тинтом.
 */
@injectable()
export class ReelsController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly animation: ReelsFrameAnimation

  constructor(@inject(TOKENS.GameTicker) ticker: GameTicker) {
    super()

    this.ticker = ticker
    this.animation = new ReelsFrameAnimation(ticker)
    this.addChild(this.animation.view)
  }

  layout(width: number, height: number): void {
    this.animation.resize(width, height)
  }

  spin(signal?: AbortSignal): Promise<void> {
    return this.ticker.waitTicks(SPIN_DURATION_MS, signal)
  }

  // параметр результата сохраняет контракт фазы под будущие барабаны
  land(_result: SpinResponse, signal?: AbortSignal): Promise<void> {
    return this.ticker.waitTicks(LAND_DURATION_MS, signal)
  }

  showTint(signal?: AbortSignal): Promise<void> {
    return this.animation.showTint(signal)
  }

  hideTint(signal?: AbortSignal): Promise<void> {
    return this.animation.hideTint(signal)
  }
}
