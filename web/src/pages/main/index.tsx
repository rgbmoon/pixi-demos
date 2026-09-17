import { A11y } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'

import { Button } from 'src/components/Button'
import { GameTile } from 'src/components/GameTile'
import { LinkOutIcon } from 'src/components/icons'

const GAME_TILES = [
  {
    to: '/slot',
    title: 'Slot machine',
    description:
      'Reel mechanics demo — the spin itself is the subject: slam stop and hold-to-spin turbo, anticipation spins, held reels and respins, hold-and-win cells and cascades. Rounds are server-authoritative; the client presents the result it receives.',
    cover: (
      <picture>
        <source srcSet="/games/slot/tile.webp" type="image/webp" />
        <img src="/games/slot/tile.jpg" alt="Slot machine" className="absolute inset-0 w-full h-full object-cover" />
      </picture>
    ),
  },
  {
    to: '/toybox',
    title: 'Toy box',
    description:
      'Isometric toy box in frame-by-frame pixel art: Aseprite animations played through a custom PixiJS animation layer. A claw travels along the grid axes above an 8×8 field, drops into the cell beneath it, and hopefully carries the toy back to the tray.',
    cover: (
      <picture>
        <source srcSet="/games/toybox/toy-box.webp" type="image/webp" />
        <img src="/games/toybox/toy-box.jpg" alt="Toy box" className="absolute inset-0 w-full h-full object-cover" />
      </picture>
    ),
  },
]

export const MainPage = () => {
  return (
    <div className="mx-auto w-full max-w-5xl flex flex-col gap-12 px-6 py-6">
      <section className="flex flex-col items-start gap-4">
        <h1 className="text-4xl font-extralight">About</h1>
        <p className="max-w-3xl text-lg font-extralight text-slate-300">
          Sergei Abrashkin — frontend developer. Five years of commercial work with React and TypeScript, enterprise
          products in retail and logistics.
          <br />
          Since 2026 — web game development on PixiJS.
        </p>
        <p className="max-w-3xl text-lg font-extralight text-slate-300">
          This site is the demo side of that work: PixiJS clients built to production-client conventions.
        </p>
        <p className="max-w-3xl text-lg font-extralight text-slate-300">
          The code base of the project is hosted on GitHub. You are welcome to explore it.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button link href="/cv/CV_Abrashkin_Sergei_EN_iGaming.pdf" target="_blank" rel="noreferrer">
            CV and Contacts (PDF)
            <LinkOutIcon width={16} height={16} />
          </Button>
          <Button link href="https://github.com/rgbmoon/pixi-demos" target="_blank" rel="noreferrer">
            Source on GitHub
            <LinkOutIcon width={16} height={16} />
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-4xl font-extralight">Demo</h2>
        <Swiper
          className="-mx-6 px-6 sm:overflow-visible"
          modules={[A11y]}
          slidesPerView={1.5}
          spaceBetween={16}
          breakpoints={{
            640: { slidesPerView: 2, spaceBetween: 24 },
            1024: { slidesPerView: 3, spaceBetween: 24 },
          }}
        >
          {GAME_TILES.map(({ to, title, description, cover }) => (
            <SwiperSlide key={to} className="h-auto">
              <GameTile to={to} title={title} description={description}>
                {cover}
              </GameTile>
            </SwiperSlide>
          ))}
        </Swiper>
      </section>
    </div>
  )
}
