import { useEffect, useRef } from 'react'

import { GameRoot } from 'src/app/game-root'

export const GamePage = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current

    if (!container) return

    const game = new GameRoot()

    void game.mount(container)

    return () => game.unmount()
  }, [])

  return <div ref={containerRef} className="w-full h-full" />
}
