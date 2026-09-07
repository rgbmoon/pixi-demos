import { injectable } from 'inversify'
import { Ticker } from 'pixi.js'
import { FATAL_MESSAGE } from 'src/core/errors/constants'
import { notifyFatal } from 'src/core/errors/utils'

/**
 * Игровой тикер: PIXI-Ticker, которым игра владеет сама, а не берёт у приложения. Причины —
 * время жизни (`app.ticker` появляется только после `await app.init()`, а конструкторам графа
 * тикер нужен раньше), игровая пауза `waitTicks` в кадрах вместо системного времени, перехват
 * исключений кадровых шагов и уничтожение вместе с game-контейнером, а не со вкладкой.
 * Экземпляр создаёт game-контейнер до PIXI-init; после init GameRoot переводит на него рендер.
 */
@injectable()
export class GameTicker extends Ticker {
  override destroy(): void {
    // Без super.destroy(): Application.destroy зовёт его до разбора сцены, а каскад stage.destroy
    // дальше снимает колбэки сам через ticker.remove
    this.stop()
  }

  override update(currentTime?: number): void {
    try {
      super.update(currentTime)
    } catch (error) {
      this.stop()

      notifyFatal(error, FATAL_MESSAGE)
    }
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
