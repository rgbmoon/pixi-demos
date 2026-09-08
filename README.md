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

## Getting started

```bash
npm ci
npm run dev            # Vite dev server
npm run lint           # eslint --fix + tsc --noEmit
npm run preview:mocks  # production build with MSW mocks enabled
```
