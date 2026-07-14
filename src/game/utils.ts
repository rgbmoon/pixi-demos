import type { Ticker } from 'pixi.js'

/**
 * Игровая пауза: промис резолвится, когда тикер накопил `durationMs` в своих кадрах.
 * В свёрнутой вкладке тикер стоит, поэтому пауза замирает вместе с картинкой. Отменяется через `signal`.
 */
export const waitTicks = (ticker: Ticker, durationMs: number, signal?: AbortSignal): Promise<void> =>
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

    const step = (currentTicker: Ticker) => {
      elapsed += currentTicker.deltaMS

      if (elapsed >= durationMs) {
        settle(resolve)
      }
    }

    const handleAbort = () => settle(() => reject(signal?.reason as Error))

    signal?.addEventListener('abort', handleAbort, { once: true })
    ticker.add(step)
  })
