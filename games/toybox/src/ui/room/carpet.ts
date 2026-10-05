import { Assets, type DestroyOptions, type Ticker } from 'pixi.js'

import { ROOM_FRAMES } from '#src/assets'
import { CARPET_DRIFT_STEP_MS } from '#src/constants'
import { isReducedMotion } from '@pixi-demos/core/accessibility'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'

import { TiledBand } from './tiled-band'

/** Ковёр на полу зала: тайл повторяется по обеим осям; `drift` запускает медленный сдвиг рисунка по горизонтали. */
export class Carpet extends TiledBand {
  /** Время, накопленное до следующего шага сдвига. */
  private pendingMs = 0

  constructor(ticker: GameTicker) {
    super(ticker, Assets.get(ROOM_FRAMES.carpet))
  }

  override destroy(options?: DestroyOptions): void {
    this.ticker.remove(this.step)
    super.destroy(options)
  }

  /** Запускает сдвиг рисунка вправо на пиксель арта за шаг; при уменьшенном движении ковёр неподвижен. */
  drift(): void {
    if (isReducedMotion()) return

    this.ticker.add(this.step)
  }

  private step = (ticker: Ticker): void => {
    this.pendingMs += ticker.deltaMS

    const steps = Math.floor(this.pendingMs / CARPET_DRIFT_STEP_MS)

    if (steps === 0) return

    this.pendingMs -= steps * CARPET_DRIFT_STEP_MS
    this.scrollBy(steps)
  }
}
