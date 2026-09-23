import type { Ticker } from 'pixi.js'

import { REDUCED_MOTION_QUERY } from '#src/constants'
import type { ProgressTweenOptions } from '#src/types'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'

/** Просит ли система уменьшить движение: по нему декоративные анимации не проигрываются. */
export const isReducedMotion = (): boolean => window.matchMedia(REDUCED_MOTION_QUERY).matches

/** Ведёт нормализованный прогресс на игровом тикере; при уменьшенном движении сразу отдаёт единицу. */
export const tweenProgress = (
  ticker: GameTicker,
  { durationMs, apply }: ProgressTweenOptions,
  signal?: AbortSignal
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason as Error)

      return
    }

    let elapsed = 0

    const settle = (finish: () => void) => {
      ticker.remove(step)
      signal?.removeEventListener('abort', handleAbort)
      finish()
    }

    const step = (frameTicker: Ticker) => {
      elapsed += frameTicker.deltaMS

      const progress = Math.min(elapsed / durationMs, 1)

      apply(progress)

      if (progress === 1) settle(resolve)
    }

    const handleAbort = () => settle(() => reject(signal?.reason as Error))

    if (isReducedMotion()) {
      apply(1)
      resolve()

      return
    }

    signal?.addEventListener('abort', handleAbort, { once: true })
    ticker.add(step)
  })
