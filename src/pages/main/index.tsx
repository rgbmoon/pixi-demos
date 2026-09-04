import { Link } from 'react-router-dom'
import { LinkOutIcon } from 'src/assets/icons'

export const MainPage = () => {
  return (
    <div className="mx-auto w-full max-w-5xl flex flex-col gap-12 px-6 py-12">
      <section className="flex flex-col items-start gap-4">
        <h1 className="text-4xl font-extralight">About</h1>
        <p className="max-w-3xl text-lg font-extralight text-slate-300">
          Sergei Abrashkin — frontend developer. Five years of commercial work with React and TypeScript, enterprise
          products in retail and logistics; since 2026 — web game development on PixiJS.
        </p>
        <p className="max-w-3xl text-lg font-extralight text-slate-300">
          This site is the demo side of that work: PixiJS clients built to production-client conventions.
        </p>
        <a
          href="/cv/CV_Abrashkin_Sergei_EN_iGaming.pdf"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 font-light text-brand-primary hover:text-brand-accent transition-colors duration-100"
        >
          CV (PDF)
          <LinkOutIcon width={16} height={16} />
        </a>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-4xl font-extralight">Demo games</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/game"
            className="group block overflow-hidden rounded-xl border border-white/15 bg-white/5 backdrop-blur-xs hover:border-brand-accent hover:shadow-[0_0_30px_-10px_var(--color-brand-accent)] transition-all duration-150"
          >
            <div className="relative aspect-video">
              <picture>
                <source srcSet="/game-assets/graphic/background/bg_default.webp" type="image/webp" />
                <img
                  src="/game-assets/graphic/background/bg_default.jpg"
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </picture>
              <picture>
                <source srcSet="/game-assets/graphic/logo/logo.webp" type="image/webp" />
                <img
                  src="/game-assets/graphic/logo/logo.png"
                  alt="Slot machine"
                  className="absolute top-1/2 left-1/2 w-[70%] -translate-x-1/2 -translate-y-1/2"
                />
              </picture>
            </div>
            <div className="flex flex-col gap-2 p-4">
              <h3 className="text-xl font-light">Slot machine</h3>
              <p className="text-sm font-extralight text-slate-300">
                Reel mechanics demo — the spin itself is the subject: independent reels, cascades, held reels, nudge and
                reverse spin, turbo and slam stop. Rounds are server-authoritative; the client presents the result it
                receives.
              </p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  )
}
