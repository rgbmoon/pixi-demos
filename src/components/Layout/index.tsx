import { Link, Outlet } from 'react-router-dom'
import { BackgroundCanvas } from 'src/components/BackgroundCanvas'
import { LogoIcon } from 'src/components/icons'
import { Snackbars } from 'src/components/Snackbars'

export const Layout = () => {
  return (
    <div className="flex relative flex-col items-center h-screen">
      <div className="fixed inset-0 -z-10">
        <BackgroundCanvas />
      </div>
      <header className="shrink-0 fixed top-0 z-10 w-full h-(--header-height) bg-slate-900/40 backdrop-blur-xl border-b border-white/10">
        <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-between gap-4 px-6">
          <Link className="flex items-center gap-2" to="/">
            <LogoIcon width={40} height={40} />
            <h1 className="text-3xl font-extralight">
              <span className="text-brand-primary">Pixi</span> <span className="text-brand-accent">Demo</span> Games
            </h1>
          </Link>
        </div>
      </header>
      <main className="flex-1 w-full overflow-auto pt-(--header-height)">
        <Outlet />
      </main>
      <Snackbars />
    </div>
  )
}
