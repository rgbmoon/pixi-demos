import type { Container, Ticker } from 'pixi.js'

import type { GameTicker } from './game-ticker'
import type { CanvasSize } from './types'

/**
 * Размер канваса: бокс с пропорциями макета игры во всю высоту доступной области.
 * Считается один раз на маунте — на ресайз окна канвас не отвечает.
 */
export const getCanvasSize = (availableWidth: number, availableHeight: number, aspectRatio: number): CanvasSize => {
  const height = Math.min(availableHeight, availableWidth / aspectRatio)

  return { width: height * aspectRatio, height }
}

/**
 * Ведёт alpha объекта к цели за `durationMs` на игровом тикере; промис резолвится на последнем кадре,
 * реджектится по `signal`. При `prefers-reduced-motion` значение выставляется сразу.
 */
export const tweenAlpha = (
  ticker: GameTicker,
  target: Container,
  to: number,
  durationMs: number,
  signal?: AbortSignal
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason as Error)

      return
    }

    const from = target.alpha
    const distance = to - from

    if (distance === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      target.alpha = to
      resolve()

      return
    }

    const settle = (finish: () => void) => {
      ticker.remove(step)
      signal?.removeEventListener('abort', handleAbort)

      finish()
    }

    const step = (frameTicker: Ticker) => {
      if (target.destroyed) {
        settle(resolve)

        return
      }

      const next = target.alpha + (distance * frameTicker.deltaMS) / durationMs

      // Знак distance учтён: условие означает «достигли или проскочили цель»
      if (Math.sign(distance) * (next - to) >= 0) {
        target.alpha = to
        settle(resolve)

        return
      }

      target.alpha = next
    }

    const handleAbort = () => settle(() => reject(signal?.reason as Error))

    signal?.addEventListener('abort', handleAbort, { once: true })

    ticker.add(step)
  })
