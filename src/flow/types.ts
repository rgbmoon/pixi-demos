import type { RootApi } from 'src/api/root-api'
import type { GameEmitter } from 'src/events/game-emitter'
import type { GameEvents } from 'src/events/types'
import type { ReelsController } from 'src/game/controllers/reels-controller'
import type { SpinStore } from 'src/stores/spin-store'
import type { PhaseName } from 'src/types/game'

/**
 * Зависимости, доступные каждой фазе. Состав комплектует биндинг `Fsm`
 * в app/game-container.ts; `signal` добавляет движок автомата.
 */
export type PhaseContext = {
  emitter: GameEmitter<GameEvents>
  reels: ReelsController
  spinStore: SpinStore
  api: RootApi
  signal: AbortSignal
}

export type Phase = {
  readonly name: PhaseName
  enter(context: PhaseContext): Promise<PhaseName> | PhaseName
  exit?(context: PhaseContext): void
}

export type FsmOptions = {
  phases: Record<PhaseName, Phase>
  initial: PhaseName
  context: Omit<PhaseContext, 'signal'>
  onPhaseChange?: (phase: PhaseName) => void
  onError?: (error: unknown) => void
}

export type CreateGameFsmOptions = Omit<FsmOptions, 'phases' | 'initial'>
