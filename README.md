# Pixi Demos

Demo game clients built with PixiJS v8 and React.

## Games

- **Slot machine** — five reels, three rows, up to ten paylines across selectable line modes.
  Bet and mode controls, autoplay with stop conditions, turbo and slam-stop, wilds, tiered win
  presentation with sound, and scatter-triggered free spins with retrigger. The server is the
  source of truth: the client presents the round it receives.

## Stack

TypeScript · PixiJS · Spine · React · MobX · Inversify · zod + partysocket · MSW · Vite · Tailwind.

## Docs

- [Reel machine](docs/reel-machine-doc.md) — headless reels model and its PIXI adapter:
  architecture, API, usage, extension.
- [CLAUDE.md](CLAUDE.md) — layer rules and conventions.

## Deploy

Live demo: https://abrashkin.netlify.app

The published site is a production build with MSW mocks enabled: there is no backend, the mock
service worker answers the game protocol in the browser.

Deploys are automated in GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) —
nothing is published from a laptop:

- **push and pull request** — `lint:ci`, unit tests and the Playwright e2e suite;
- **merge into `main`** — publishes to Netlify production the exact build that passed e2e. The deploy
  job depends on both check jobs, so a red run never ships. Merging is the release;
- **manual re-deploy** — Actions → CI → _Run workflow_ on `main`. It re-runs every check first;
- **rollback** — Netlify → Deploys → _Publish deploy_ on an earlier build, then revert in git.

Deploy only ever runs from `main`; other branches get checks only.

## Getting started

```bash
npm ci
npm run dev            # Vite dev server
npm run lint           # eslint --fix + tsc --noEmit
npm run preview:mocks  # production build with MSW mocks enabled
npm test               # vitest: unit tests and round scenarios
npm run e2e            # production build with mocks + Playwright (chromium)
```
