import { useEffect, useRef } from 'react'

import { createGameContainer, destroyGameContainer } from 'src/app/container'
import { TOKENS } from 'src/constants/tokens'

export const GamePage = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current

    if (!container) return

    // Роут-страница — точка входа: монтирует game-контейнер и владеет его временем жизни
    const game = createGameContainer()
    const root = game.get(TOKENS.GameRoot)

    void root.mount(container)

    return () => destroyGameContainer()
  }, [])

  return (
    <div className="h-full flex justify-center">
      <div ref={containerRef} className="h-full max-w-full aspect-9/16" />
    </div>
  )
}
