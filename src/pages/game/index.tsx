import { useEffect, useRef, useState } from 'react'

import { createGameContainer, destroyGameContainer } from 'src/app/container'
import { TOKENS } from 'src/constants/tokens'
import { preloadGameAssets } from 'src/game/assets'

export const GamePage = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false

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
        // Бутстрап упал (ассеты или данные раунда) — оверлей остаётся и сообщает об ошибке
        if (disposed) return

        setError(cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause))
      }
    }

    void boot()

    return () => {
      disposed = true
      destroyGameContainer()
    }
  }, [])

  return (
    <div className="h-full flex justify-center">
      <div ref={containerRef} className="relative h-full max-w-full aspect-9/16">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-800">
            {error ? (
              <div className="px-6 text-center text-white">
                <p>Не удалось загрузить игру. Обновите страницу.</p>
                <p className="mt-3 text-sm wrap-break-word text-white/60">{error}</p>
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
