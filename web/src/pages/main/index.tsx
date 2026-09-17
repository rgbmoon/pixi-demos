import { A11y } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'

import { Button } from 'src/components/Button'
import { GameTile } from 'src/components/GameTile'
import { LinkOutIcon } from 'src/components/icons'

const GAME_TILES = [
  {
    to: '/slot',
    title: 'Slot',
    description:
      'Reel machine demo — demonstrates various reel mechanics. The game is built around the reel machine itself: an embeddable engine for any slot game, highly customizable for rapid development and optimized for mobile devices.',
    cover: (
      <picture>
        <source srcSet="/games/slot/tile.webp" type="image/webp" />
        <img src="/games/slot/tile.jpg" alt="Slot machine" className="absolute inset-0 w-full h-full object-cover" />
      </picture>
    ),
  },
  {
    to: '/toybox',
    title: 'Toy Box',
    description:
      'Isometric claw machine made with frame-by-frame pixel art. Aseprite animations played through a custom PixiJS animation layer. Optimized for mobile devices with touch controls.',
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
          Sergei Abrashkin — frontend developer with five years of commercial experience in React and TypeScript,
          shipping enterprise products for retail and logistics.
        </p>
        <p className="max-w-3xl text-lg font-extralight text-slate-300">
          Since 2026 my focus is web game development on PixiJS — building high-performance games with a strong
          architecture underneath, and close attention to performance and accessibility.
        </p>
        <p className="max-w-3xl text-lg font-extralight text-slate-300">
          Feel free to play the games below. The code behind them is available on{' '}
          <a
            href="https://github.com/rgbmoon/pixi-demos"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 align-baseline text-brand-primary hover:text-brand-white transition-colors duration-100"
          >
            GitHub
            <LinkOutIcon width={16} height={16} />
          </a>
          .
        </p>
        <div className="flex flex-wrap gap-3">
          <Button link href="/cv/CV_Abrashkin_Sergei_EN_iGaming.pdf" target="_blank" rel="noreferrer">
            CV and Contacts (PDF)
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
