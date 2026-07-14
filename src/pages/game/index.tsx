import { useEffect, useRef } from 'react'

import { appContainer } from 'src/app/container'
import { TOKENS } from 'src/constants/tokens'

export const GamePage = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current

    if (!container) return

    // Роут-страница — точка входа: резолвит транзиентный GameRoot и владеет его mount/unmount
    const game = appContainer.get(TOKENS.GameRoot)

    void game.mount(container)

    return () => game.unmount()
  }, [])

  return <div ref={containerRef} className="w-full h-full" />
}
