import { useEffect, useRef } from 'react'

import { gameRoot } from 'src/stores/game-root'

export const GamePage = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current

    if (!container) return

    void gameRoot.mount(container)

    return () => gameRoot.unmount()
  }, [])

  return <div ref={containerRef} className="w-full h-full" />
}
