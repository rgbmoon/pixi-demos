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

  return (
    <div className="h-full flex justify-center">
      <div ref={containerRef} className="h-full max-w-full aspect-9/16" />
    </div>
  )
}
