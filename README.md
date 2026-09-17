# Pixi Demos

Demo game clients built with PixiJS v8 and React.

## Games

- **Slot machine** — a reel mechanics demo: five reels, three rows, up to ten paylines across
  selectable line modes. Bet and line-mode controls, win line presentation, slam stop,
  hold-to-spin turbo, anticipation spins, sticky-wild respins with held reels, a hold-and-win
  bonus on single-cell reels, and cascades with a growing win multiplier. The server is the source
  of truth: the client presents the round it receives.
- **Toy box** — an isometric claw machine in frame-by-frame pixel art: animation frames come from
  Aseprite. Under development.

## Stack

TypeScript · PixiJS · Spine · React · MobX · Inversify · zod + partysocket · MSW · Vite · Tailwind ·
pnpm workspaces + Turborepo.

## Repository layout

A pnpm monorepo: every folder below is a workspace package with its own dependencies and tests.

```
packages/core                 pure TS: errors, events, FSM, palette, easing, storage
packages/net                  WebSocket transport, message envelope, mock helpers
packages/engine               PIXI runtime: host, ticker, skeleton pool, audio synth
packages/reels                reel machine model: standalone, no dependencies
packages/reels-pixi-adapter   PIXI adapter for the reel machine model
games/slot                    the slot game: its unit tests and e2e specs live here
games/toybox                  the toy box game: : its unit tests and e2e specs live here
web                           the application: composition root, pages, React kit, assets
```

Turborepo caches every task by the hash of its inputs, so lint, typecheck, unit tests and e2e run only
for packages whose inputs changed. E2E are split by game: a change in one game does not re-run
another game's e2e.

## Docs

- [Reel machine](docs/reel-machine.html) — headless reels model and its PIXI adapter:
  architecture, diagrams, integration with the game, extension.
- [Testing strategy](docs/testing.html) — test layers, what is covered and why.
- [CLAUDE.md](CLAUDE.md) — layer rules and conventions.

## Deploy

Live demo: https://pixi-demo.netlify.app

The published site is a production build with MSW mocks enabled: there is no backend, the mock
service worker answers the game protocol in the browser.

Deploys are automated in GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) —
nothing is published from a laptop:

- **push and pull request** — lint, typecheck, unit tests and the Playwright e2e suite. Tasks whose
  inputs match a previous run are restored from the Turborepo cache;
- **merge into `main`** — publishes to Netlify production the exact build that passed e2e. The deploy
  job depends on both check jobs, so a red run never ships. Merging is the release;
- **manual re-deploy** — Actions → CI → _Run workflow_ on `main`. It re-runs every check first,
  bypassing the cache;
- **rollback** — Netlify → Deploys → _Publish deploy_ on an earlier build, then revert in git.

Deploy only ever runs from `main`; other branches get checks only.

## Getting started

```bash
pnpm install
pnpm dev                                # Vite dev server
pnpm lint                               # eslint --fix + tsc, changed packages only
pnpm preview:mocks                      # production build with MSW mocks enabled
pnpm test                               # vitest: unit tests and round scenarios
pnpm e2e                                # production build with mocks + Playwright (chromium)
pnpm e2e --filter=@pixi-demos/slot      # e2e of one game
pnpm --filter @pixi-demos/slot test:watch
```
