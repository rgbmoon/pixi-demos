import type { PhaseName } from 'src/types/game'

import type { FsmOptions, Phase, PhaseContext } from './types'

/**
 * Движок конечного автомата. Граф переходов держат сами фазы; движок крутит петлю и не знает их порядка.
 */
export class Fsm {
  private readonly phases: Record<PhaseName, Phase>
  private readonly initial: PhaseName
  private readonly context: PhaseContext
  private readonly onPhaseChange?: (phase: PhaseName) => void
  private readonly onError?: (error: unknown) => void

  private readonly controller = new AbortController()

  /**
   * Принимает словарь фаз, имя стартовой, зависимости фаз и колбэки на смену фазы и на ошибку.
   * `signal` в контекст фаз добавляет сам — им же гасит автомат в `dispose`.
   */
  constructor({ phases, initial, context, onPhaseChange, onError }: FsmOptions) {
    this.phases = phases
    this.initial = initial
    this.onPhaseChange = onPhaseChange
    this.onError = onError
    this.context = { ...context, signal: this.controller.signal }
  }

  /**
   * Запускает петлю фаз со стартовой фазы и крутит её, пока автомат не остановят.
   */
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

  /**
   * Останавливает автомат: абортит `signal` контекста, из-за чего реджектятся все ожидания
   * внутри фаз (события, анимации, запросы), а петля останавливается, не начав следующую фазу.
   */
  dispose(): void {
    this.controller.abort(new Error('Игровой автомат остановлен'))
  }
}
