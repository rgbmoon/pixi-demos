import { useEffect, useRef } from 'react'

import { bgStore } from 'src/stores/bg'

export const BackgroundCanvas = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current

    if (!container) return

    void bgStore.mount(container)

    return () => bgStore.unmount()
  }, [])

  return <div ref={containerRef} className="w-full h-full" />
}
