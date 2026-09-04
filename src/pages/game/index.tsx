import { useEffect, useRef, useState } from 'react'

import { createGameContainer, destroyGameContainer } from 'src/app/container'
import { Button } from 'src/components/Button'
import { TOKENS } from 'src/constants/tokens'
import { type Notice, NoticeSeverity } from 'src/errors/types'
import { notifyFatal, onNotice } from 'src/errors/utils'
import { preloadGameAssets } from 'src/game/assets'

export const GamePage = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [fatal, setFatal] = useState<Notice | null>(null)

  useEffect(() => {
    let disposed = false

    // Подписка ставится до бутстрапа: провал ассетов, смерть автомата и упавший тик приходят одним путём
    const offNotice = onNotice((notice) => {
      if (disposed || notice.severity !== NoticeSeverity.fatal) return

      // Первая фатальная и остаётся на экране: последующие уже её следствия
      setFatal((current) => current ?? notice)
    })

    // Ассеты грузятся до сборки графа: конструкторы сцены читают их из кэша синхронно
    const boot = async () => {
      try {
        await preloadGameAssets()

        if (disposed || !containerRef.current) return

        const game = createGameContainer()
        const root = game.get(TOKENS.GameRoot)

        await root.mount(containerRef.current)

        if (!disposed) setLoading(false)
      } catch (cause) {
        if (disposed) return

        notifyFatal(cause, 'Failed to load the game')
      }
    }

    void boot()

    return () => {
      disposed = true
      offNotice()
      destroyGameContainer()
    }
  }, [])

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
