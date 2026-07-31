import { PAYLINE_PREVIEW_MS, PAYLINES } from 'src/game/constants'
import type { GameTicker } from 'src/game/game-ticker'
import { LiveContainer } from 'src/game/ui/live-container'
import { getActiveLineIds } from 'src/game/utils'
import type { SceneStore } from 'src/stores/scene-store'

import { PaylineAnimation } from '../animations/payline-animation'

export class PaylinesController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly sceneStore: SceneStore
  private readonly lines = new Map<string, PaylineAnimation>()
  private previewAbort?: AbortController

  constructor(ticker: GameTicker, sceneStore: SceneStore) {
    super()

    this.ticker = ticker
    this.sceneStore = sceneStore

    Object.keys(PAYLINES).forEach((lineId) => {
      const line = new PaylineAnimation(lineId)

      this.lines.set(lineId, line)
      this.addChild(line.view)
    })

    this.watch(
      () => sceneStore.gameMode,
      () => void this.preview()
    )

    this.watch(
      () => sceneStore.isIdle,
      (isIdle) => {
        if (isIdle) return

        this.cancelPreview()
        this.hide()
      }
    )
  }

  /** Показывает переданные линии, остальные гасит. */
  show(lineIds: string[]): void {
    if (this.destroyed) return

    const visible = new Set(lineIds)

    this.lines.forEach((line, lineId) => (visible.has(lineId) ? line.show() : line.hide()))
  }

  hide(): void {
    if (this.destroyed) return

    this.lines.forEach((line) => line.hide())
  }

  /** Показ линий режима на `PAYLINE_PREVIEW_MS`; следующее нажатие рисует новый набор, не дожидаясь конца показа. */
  private async preview(): Promise<void> {
    this.cancelPreview()

    const abort = new AbortController()

    this.previewAbort = abort

    this.show(getActiveLineIds(this.sceneStore.lines))

    try {
      await this.ticker.waitTicks(PAYLINE_PREVIEW_MS, abort.signal)

      this.hide()
    } catch {
      // Показ прерван следующим нажатием: линии уже перерисованы его вызовом show
    } finally {
      // Отклонение промиса приходит после того, как новый показ записал свой контроллер, — чужой не затираем
      if (this.previewAbort === abort) this.previewAbort = undefined
    }
  }

  private cancelPreview(): void {
    this.previewAbort?.abort()
    this.previewAbort = undefined
  }
}
