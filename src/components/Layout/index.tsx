import { Outlet } from 'react-router-dom'
import { LogoIcon } from 'src/assets/icons'

export const Layout = () => {
  return (
    <div className="flex relative flex-col items-center h-screen">
      <header className="items-center justify-between shrink-0 fixed top-0 z-10 flex gap-4 w-full p-3 h-(--header-height) bg-slate-900/40 backdrop-blur-xl border-b border-white/10">
        <a className="flex items-center gap-2" href="/">
          <LogoIcon width={40} height={40} />
          <h1 className="text-3xl font-extralight">Pixi Game</h1>
        </a>
      </header>
      <main className="flex-1 w-full overflow-auto pt-(--header-height)">
        <Outlet />
      </main>
    </div>
  )
}
