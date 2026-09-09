import type { Application, Container, Ticker } from 'pixi.js'
import { traceError } from 'src/core/errors/utils'

import type { GameTicker } from './game-ticker'
import type { CanvasConfig, CanvasSize } from './types'

/**
 * Отдаёт приложение расширению PixiJS DevTools и добавляет к нему свои GPU-метрики.
 * `null` снимает ссылку на уничтоженное приложение. Зовётся после `app.init()` — пакет
 * сразу читает `renderer` и `stage`. В прод-сборке тело сворачивается, пакет в бандл не попадает.
 */
export const connectDevtools = async (app: Application | null): Promise<void> => {
  if (!import.meta.env.DEV) {
    return
  }

  try {
    const [{ initDevtools }, { createGpuStats }, { createGpuTree }] = await Promise.all([
      import('@pixi/devtools'),
      import('./devtools/stats'),
      import('./devtools/tree'),
    ])

    // Расширения ставятся один раз на вкладку: initDevtools складывает их с уже зарегистрированными,
    // и на повторном маунте страницы игры набор бы задвоился. Регистрация идёт через глобал пакета:
    // в его опциях тип extensions сужен до оверлеев
    if (!window.__PIXI_DEVTOOLS__?.extensions?.length) {
      window.__PIXI_DEVTOOLS__ = { ...window.__PIXI_DEVTOOLS__, extensions: [createGpuStats(), createGpuTree()] }
    }

    await initDevtools(app ? { app } : {})
  } catch (error) {
    traceError?.(error, 'PixiJS devtools failed to connect')
  }
}

/**
 * Размер канваса: до `fillMaxWidth` канвас занимает всю доступную область, выше — бокс
 * с пропорциями макета во всю её высоту. Пропорции канваса учитывает `layout` сцены.
 */
export const getCanvasSize = (
  availableWidth: number,
  availableHeight: number,
  { aspectRatio, fillMaxWidth }: CanvasConfig
): CanvasSize => {
  if (availableWidth <= fillMaxWidth) {
    return { width: availableWidth, height: availableHeight }
  }

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
