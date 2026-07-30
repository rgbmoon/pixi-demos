import type { GameTicker } from 'src/game/game-ticker'
import type { SpinePool } from 'src/game/spine-pool'
import { LiveContainer } from 'src/game/ui/live-container'
import type { SceneStore } from 'src/stores/scene-store'

export class WinFramesController extends LiveContainer {
  private sceneStore: SceneStore
  private containerWidth: number = 0
  private containerHeight: number = 0

  constructor(ticker: GameTicker, pool: SpinePool, sceneStore: SceneStore) {
    super()

    this.sceneStore = sceneStore
  }

  showWinFrames() {}

  hideWinFrames() {}

  layout(containerWidth: number, containerHeight: number) {
    this.containerWidth = containerWidth
    this.containerHeight = containerHeight
  }
}
