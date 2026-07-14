import { useEffect, useRef } from 'react'

import { mountBackground } from '../utils'

export const BackgroundCanvas = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current

    if (!container) return

    return mountBackground(container)
  }, [])

  return <div ref={containerRef} className="w-full h-full" />
}
