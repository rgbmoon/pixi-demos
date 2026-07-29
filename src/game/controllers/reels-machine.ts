import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import { ReelsFrameAnimation } from 'src/game/animations/reels-frame-animation'
import { REELS_MACHINE_SCALE, REELS_ZONE_HEIGHT, REELS_ZONE_WIDTH } from 'src/game/constants'
import type { GameTicker } from 'src/game/game-ticker'
import type { SpinePool } from 'src/game/spine-pool'
import { LiveContainer } from 'src/game/ui/live-container'
import type { SceneStore } from 'src/stores/scene-store'
import type { SymbolKey } from 'src/types/game'

import { ReelSetController } from './reel-set'

@injectable()
export class ReelsMachineController extends LiveContainer {
  private readonly reelsFrameAnimation: ReelsFrameAnimation
  private readonly reelSet: ReelSetController

  constructor(
    @inject(TOKENS.GameTicker) ticker: GameTicker,
    @inject(TOKENS.SpinePool) pool: SpinePool,
    @inject(TOKENS.SceneStore) sceneStore: SceneStore
  ) {
    super()

    this.reelsFrameAnimation = new ReelsFrameAnimation(pool)

    this.scale.set(REELS_MACHINE_SCALE)

    this.reelSet = new ReelSetController(ticker, pool, sceneStore)
    this.reelSet.layout(REELS_ZONE_WIDTH, REELS_ZONE_HEIGHT)

    this.reelsFrameAnimation.addChildToSymbolsSlot(this.reelSet)

    this.addChild(this.reelsFrameAnimation.view)
  }

  // TODO пока что кажется, что тут должны быть описаны все публичные методы рил машины:
  // 1) запуск/остановка всех анимаций - tint, вращение барабанов, win symbols, win frames, paylines
  // 2) пока неочевидно, но кажется тут так-же можно прописать какое то поведение машины. Либо же все поведение хранить в FSM
  // а машина только выполняет то что дергает FSM.
  // Так-же здесь подключаются слои в рамку

  spin() {
    this.reelSet.spin()
  }

  land(symbolKeys: SymbolKey[][] | undefined, signal?: AbortSignal): Promise<void> {
    return this.reelSet.land(symbolKeys, signal)
  }
}
