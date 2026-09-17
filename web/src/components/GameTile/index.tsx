import type { ReactNode } from 'react'

import { Link } from 'react-router-dom'

interface GameTileProps {
  to: string
  title: string
  description: string
  children: ReactNode
}

export const GameTile = ({ to, title, description, children }: GameTileProps) => (
  <Link
    to={to}
    className="group flex h-full flex-col overflow-hidden rounded-xl border border-white/15 bg-white/5 backdrop-blur-xs hover:border-brand-accent hover:shadow-[0_0_30px_-10px_var(--color-brand-accent)] transition-all duration-150"
  >
    <div className="relative aspect-3/2">{children}</div>
    <div className="flex flex-col gap-2 p-4">
      <h3 className="text-xl font-light">{title}</h3>
      <p className="text-sm font-extralight text-slate-300">{description}</p>
    </div>
  </Link>
)
