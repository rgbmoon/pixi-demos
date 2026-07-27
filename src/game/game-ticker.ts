import { injectable } from 'inversify'
import { Ticker } from 'pixi.js'

// TODO не уверен что нужен отдельный тикер
/**
 * Игровой тикер: PIXI-Ticker, дополненный игровой паузой `waitTicks`.
 * Экземпляр создаёт game-контейнер до PIXI-init; после init GameRoot переводит на него рендер.
 */
@injectable()
export class GameTicker extends Ticker {
  destroyed = false

  override destroy(): void {
    this.destroyed = true

    super.destroy()
  }

  /**
   * Игровая пауза: промис резолвится, когда тикер накопил `durationMs` в своих кадрах.
   * В свёрнутой вкладке тикер стоит, поэтому пауза замирает вместе с картинкой. Отменяется через `signal`.
   */
  waitTicks(durationMs: number, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason as Error)

        return
      }

      let elapsed = 0

      const settle = (finish: () => void) => {
        this.remove(step)
        signal?.removeEventListener('abort', handleAbort)

        finish()
      }

      const step = (ticker: Ticker) => {
        elapsed += ticker.deltaMS

        if (elapsed >= durationMs) {
          settle(resolve)
        }
      }

      const handleAbort = () => settle(() => reject(signal?.reason as Error))

      signal?.addEventListener('abort', handleAbort, { once: true })
      this.add(step)
    })
  }
}
