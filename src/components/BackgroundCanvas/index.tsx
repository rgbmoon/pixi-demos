import { useRef } from 'react'

// TODO доделать БГ канвас

export const BackgroundCanvas = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  return <div ref={containerRef} className="w-full h-full" />
}
