import type { Ticker } from 'pixi.js'
import type { GameEmitter } from 'src/events/game-emitter'
import type { GameEvents } from 'src/events/types'
import type { ReelsController } from 'src/game/controllers/reels-controller'
import type { PhaseName } from 'src/types/game'

export type PhaseContext = {
  emitter: GameEmitter<GameEvents>
  ticker: Ticker
  reels: ReelsController
  signal: AbortSignal
}

export type Phase = {
  readonly name: PhaseName
  enter(context: PhaseContext): Promise<PhaseName> | PhaseName
  exit?(context: PhaseContext): void
}
