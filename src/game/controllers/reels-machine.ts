import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import { ReelsFrameAnimation } from 'src/game/animations/reels-frame-animation'
import type { GameTicker } from 'src/game/game-ticker'
import { LiveContainer } from 'src/game/ui/live-container'
import type { SceneStore } from 'src/stores/scene-store'
import type { SymbolKey } from 'src/types/game'

import { ReelSetController } from './reel-set'

// зона символов внутри рамки: пять шагов между divider_center и высота разделителя, обе величины из frame.json
const NATIVE_ZONE_WIDTH = 1006.7
const NATIVE_ZONE_HEIGHT = 589

// масштаб задаётся один раз, на ресайз экрана машина не реагирует (пока что)
const SCALE = 0.4

@injectable()
export class ReelsMachineController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly reelsFrameAnimation: ReelsFrameAnimation
  private readonly reelSet: ReelSetController

  constructor(@inject(TOKENS.GameTicker) ticker: GameTicker, @inject(TOKENS.SceneStore) sceneStore: SceneStore) {
    super()

    this.ticker = ticker
    this.reelsFrameAnimation = new ReelsFrameAnimation()

    this.scale.set(SCALE)

    this.reelSet = new ReelSetController(ticker, sceneStore)
    this.reelSet.layout(NATIVE_ZONE_WIDTH, NATIVE_ZONE_HEIGHT)

    this.reelsFrameAnimation.addChildToSymbolsSlot(this.reelSet)

    this.addChild(this.reelsFrameAnimation.view)
  }

  // TODO пока что кажется, что тут должны быть описаны все публичные методы рил машины:
  // 1) запуск/остановка всех анимаций - tint, вращение барабанов, win symbols, win frames, paylines
  // 2) пока неочевидно, но кажется тут так-же можно прописать какое то поведение машины. Либо же все поведение хранить в FSM
  // а машина только выполняет то что дергает FSM.
  // Так-же здесь подключаются слои в рамку

  spin(signal?: AbortSignal): Promise<void> {
    return this.ticker.waitTicks(300, signal)
  }

  land(symbolKeys: SymbolKey[][] | undefined, signal?: AbortSignal): Promise<void> {
    this.reelSet.setSymbols(symbolKeys)

    return this.ticker.waitTicks(300, signal)
  }
}
