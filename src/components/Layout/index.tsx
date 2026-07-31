import { Link, Outlet } from 'react-router-dom'
import { LogoIcon } from 'src/assets/icons'
import { BackgroundCanvas } from 'src/components/BackgroundCanvas'
import { Snackbars } from 'src/components/Snackbars'

export const Layout = () => {
  return (
    <div className="flex relative flex-col items-center h-screen">
      <div className="fixed inset-0 -z-10">
        <BackgroundCanvas />
      </div>
      <header className="items-center justify-between shrink-0 fixed top-0 z-10 flex gap-4 w-full p-3 h-(--header-height) bg-slate-900/40 backdrop-blur-xl border-b border-white/10">
        <Link className="flex items-center gap-2" to="/">
          <LogoIcon width={40} height={40} />
          <h1 className="text-3xl font-extralight">Pixi Game</h1>
        </Link>
      </header>
      <main className="flex-1 w-full overflow-auto pt-(--header-height)">
        <Outlet />
      </main>
      <Snackbars />
    </div>
  )
}
