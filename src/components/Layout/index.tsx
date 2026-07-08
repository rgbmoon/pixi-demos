import { Outlet } from 'react-router-dom'
import { LogoIcon } from 'src/assets/icons'
import headerBg from 'src/assets/img/header-bg.svg?url'

export const Layout = () => {
  return (
    <div className="flex relative flex-col items-center h-screen">
      <header
        className="items-center justify-between shrink-0 sticky top-0 flex gap-4 w-full p-3 h-[--header-height]"
        style={{ background: `url("${headerBg}") repeat-x center/auto 100%` }}
      >
        <a className="flex items-center gap-2" href="/">
          <LogoIcon width={40} height={40} />
          <h1 className="text-3xl font-extralight">Pixi Game</h1>
        </a>
      </header>
      <main className="flex-1 w-full overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
