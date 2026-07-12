import type { PhaseName } from 'src/types/game'

import type { Phase, PhaseContext } from './types'

type FsmOptions = {
  phases: Record<PhaseName, Phase>
  initial: PhaseName
  context: Omit<PhaseContext, 'signal'>
  onPhaseChange?: (phase: PhaseName) => void
  onError?: (error: unknown) => void
}

/** Движок конечного автомата на промисах. */
export class Fsm {
  private readonly phases: Record<PhaseName, Phase>
  private readonly initial: PhaseName
  private readonly context: PhaseContext
  private readonly onPhaseChange?: (phase: PhaseName) => void
  private readonly onError?: (error: unknown) => void

  private readonly controller = new AbortController()

  constructor({ phases, initial, context, onPhaseChange, onError }: FsmOptions) {
    this.phases = phases
    this.initial = initial
    this.onPhaseChange = onPhaseChange
    this.onError = onError
    this.context = { ...context, signal: this.controller.signal }
  }

  async start(): Promise<void> {
    let next = this.initial

    while (!this.controller.signal.aborted) {
      const phase = this.phases[next]

      this.onPhaseChange?.(phase.name)

      try {
        next = await phase.enter(this.context)
      } catch (error) {
        if (this.controller.signal.aborted) {
          return
        }

        this.onError?.(error)

        return
      } finally {
        phase.exit?.(this.context)
      }
    }
  }

  dispose(): void {
    this.controller.abort(new Error('Игровой автомат остановлен'))
  }
}
