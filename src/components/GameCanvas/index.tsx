import { useEffect, useRef, useState } from 'react'

import { Button } from 'src/components/Button'
import { type Notice, NoticeSeverity } from 'src/core/errors/types'
import { createAbortError, notifyFatal, onNotice } from 'src/core/errors/utils'

interface GameCanvasProps {
  /** Поднимает игру внутри элемента; `signal` абортится при уходе со страницы. */
  boot: (element: HTMLElement, signal: AbortSignal) => Promise<void>
  /** Разбирает всё, что подняла `boot`. Вызывается при уходе со страницы. */
  dispose: () => void
}

/**
 * Место под канвас в React-дереве: поднимает игру на маунте и разбирает на размонтировании.
 * Сам PIXI-мир держит `GameRoot` на стороне движка.
 * Пока игра не готова, показывает загрузку, а фатальную ошибку — оверлеем поверх канваса.
 */
export const GameCanvas = ({ boot, dispose }: GameCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [fatal, setFatal] = useState<Notice | null>(null)

  useEffect(() => {
    let disposed = false

    const abort = new AbortController()

    // Подписка ставится до бутстрапа: провал ассетов, смерть автомата и упавший тик приходят одним путём
    const offNotice = onNotice((notice) => {
      if (disposed || notice.severity !== NoticeSeverity.fatal) return

      // Первая фатальная и остаётся на экране: последующие уже её следствия
      setFatal((current) => current ?? notice)
    })

    const run = async () => {
      try {
        if (!containerRef.current) return

        await boot(containerRef.current, abort.signal)

        if (!disposed) setLoading(false)
      } catch (cause) {
        if (disposed) return

        notifyFatal(cause, 'Failed to load the game')
      }
    }

    void run()

    return () => {
      disposed = true
      abort.abort(createAbortError('Game page unmounted'))
      offNotice()
      dispose()
    }
  }, [boot, dispose])

  return (
    <div className="h-full flex justify-center">
      <div ref={containerRef} className="relative h-full w-full flex items-center justify-center">
        {(loading || fatal) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-800">
            {fatal ? (
              <div className="flex flex-col items-center gap-3 px-6 text-center text-white">
                <p>{fatal.message}</p>
                {fatal.detail && <p className="text-sm wrap-break-word text-white/60">{fatal.detail}</p>}
                <Button onClick={() => window.location.reload()}>Reload</Button>
              </div>
            ) : (
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
